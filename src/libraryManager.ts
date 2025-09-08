import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { ConfigManager } from './configManager';

interface Library {
    name: string;
    version?: string;
    installed: boolean;
    hasUpdate: boolean;
    latestVersion?: string;
}

export class LibraryManager {
    private configManager: ConfigManager;
    private cacheFile: string;
    private cacheExpiration: number = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    constructor(configManager: ConfigManager, context?: vscode.ExtensionContext) {
        this.configManager = configManager;
        // Cache in extension's global storage directory
        if (context) {
            this.cacheFile = path.join(context.globalStorageUri.fsPath, 'libs_cache.json');
        } else {
            // Fallback to temp directory
            this.cacheFile = path.join(require('os').tmpdir(), 'arduino-cursor', 'libs_cache.json');
        }
    }

    public async openLibraryManager(): Promise<void> {
        try {
            const libraries = await this.getLibraries();
            if (libraries.length === 0) {
                vscode.window.showErrorMessage('No libraries found. Try refreshing the cache.');
                return;
            }

            // Create quick pick items with status indicators
            const items = libraries.map(lib => {
                let label = lib.name;
                let description = '';

                if (lib.installed) {
                    label = `✅ ${lib.name}`;
                    if (lib.hasUpdate) {
                        label = `🔄 ${lib.name}`;
                        description = `Installed: ${lib.version} → Latest: ${lib.latestVersion}`;
                    } else {
                        description = `Installed: ${lib.version}`;
                    }
                } else {
                    label = `📦 ${lib.name}`;
                    description = 'Not installed';
                }

                return {
                    label: label,
                    description: description,
                    library: lib
                };
            });

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a library to install/update',
                matchOnDescription: true
            });

            if (selected) {
                await this.handleLibraryAction(selected.library);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error opening library manager: ${error}`);
        }
    }

    private async handleLibraryAction(library: Library): Promise<void> {
        const arduinoCli = this.configManager.getArduinoCliPath();
        const action = library.installed ? (library.hasUpdate ? 'update' : 'reinstall') : 'install';
        
        try {
            vscode.window.showInformationMessage(`${action === 'update' ? 'Updating' : 'Installing'} library: ${library.name}`);
            
            await this.runCommand(`${arduinoCli} lib install "${library.name}"`);
            
            const message = library.hasUpdate ? 
                `Library "${library.name}" updated successfully!` : 
                `Library "${library.name}" installed successfully!`;
            
            vscode.window.showInformationMessage(message);
            
            // Refresh the library manager
            this.openLibraryManager();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to ${action} library "${library.name}": ${error}`);
        }
    }

    private async getLibraries(): Promise<Library[]> {
        // Try to load from cache first
        const cachedLibraries = this.loadFromCache();
        if (cachedLibraries) {
            return cachedLibraries;
        }

        // Fetch fresh data
        return await this.fetchLibraries();
    }

    private loadFromCache(): Library[] | null {
        try {
            if (!fs.existsSync(this.cacheFile)) {
                return null;
            }

            const stats = fs.statSync(this.cacheFile);
            const now = Date.now();
            
            if (now - stats.mtime.getTime() > this.cacheExpiration) {
                return null; // Cache expired
            }

            const data = fs.readFileSync(this.cacheFile, 'utf8');
            const cached = JSON.parse(data);
            
            // Validate cache structure
            if (cached && cached.libraries && Array.isArray(cached.libraries)) {
                vscode.window.showInformationMessage(`Loading ${cached.libraries.length} libraries from cache...`);
                return cached.libraries;
            }
            
            return null;
        } catch (error) {
            console.error('Error loading cache:', error);
            return null;
        }
    }

    private async fetchLibraries(): Promise<Library[]> {
        try {
            vscode.window.showInformationMessage('Fetching libraries from arduino-cli...');
            
            const arduinoCli = this.configManager.getArduinoCliPath();
            
            // First, try to get installed and outdated libraries (these are smaller)
            const [installedLibs, outdatedLibs] = await Promise.all([
                this.getInstalledLibraries(arduinoCli),
                this.getOutdatedLibraries(arduinoCli)
            ]);

            // Try to get available libraries with a streaming approach
            const availableLibs = await this.getAvailableLibrariesStreaming(arduinoCli);

            const libraries: Library[] = availableLibs.map(lib => ({
                name: lib.name,
                version: lib.version,
                installed: installedLibs.has(lib.name),
                hasUpdate: outdatedLibs.has(lib.name),
                latestVersion: outdatedLibs.get(lib.name)
            }));

            // Save to cache
            this.saveToCache(libraries);
            
            return libraries;
        } catch (error) {
            vscode.window.showErrorMessage(`Error fetching libraries: ${error}`);
            // Try to load from cache as fallback
            const cached = this.loadFromCache();
            if (cached) {
                vscode.window.showInformationMessage('Using cached library data...');
                return cached;
            }
            return [];
        }
    }

    private async getAvailableLibrariesStreaming(arduinoCli: string): Promise<Array<{name: string, version?: string}>> {
        return new Promise((resolve, reject) => {
            exec(`${arduinoCli} lib search --format json`, {
                maxBuffer: Infinity // No buffer limit
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }

                try {
                    const data = JSON.parse(stdout);
                    const libraries = data.libraries || [];
                    resolve(libraries.map((lib: any) => ({
                        name: lib.name,
                        version: lib.version
                    })));
                } catch (parseError) {
                    reject(parseError);
                }
            });
        });
    }

    private async getAvailableLibraries(arduinoCli: string): Promise<Array<{name: string, version?: string}>> {
        return new Promise((resolve, reject) => {
            exec(`${arduinoCli} lib search --format json`, {
                maxBuffer: Infinity // No buffer limit
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }

                try {
                    const data = JSON.parse(stdout);
                    const libraries = data.libraries || [];
                    resolve(libraries.map((lib: any) => ({
                        name: lib.name,
                        version: lib.version
                    })));
                } catch (parseError) {
                    reject(parseError);
                }
            });
        });
    }

    private async getInstalledLibraries(arduinoCli: string): Promise<Map<string, string>> {
        return new Promise((resolve, reject) => {
            exec(`${arduinoCli} lib list --format json`, {
                maxBuffer: Infinity // No buffer limit
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }

                try {
                    const data = JSON.parse(stdout);
                    const installed = new Map<string, string>();
                    
                    if (data.installed_libraries) {
                        for (const entry of data.installed_libraries) {
                            if (entry.library && entry.library.name) {
                                installed.set(entry.library.name, entry.library.version);
                            }
                        }
                    }
                    
                    resolve(installed);
                } catch (parseError) {
                    reject(parseError);
                }
            });
        });
    }

    private async getOutdatedLibraries(arduinoCli: string): Promise<Map<string, string>> {
        return new Promise((resolve, reject) => {
            exec(`${arduinoCli} lib outdated --format json`, {
                maxBuffer: Infinity // No buffer limit
            }, (error, stdout, stderr) => {
                if (error) {
                    // It's okay if this fails - just means no outdated libraries
                    resolve(new Map());
                    return;
                }

                try {
                    const data = JSON.parse(stdout);
                    const outdated = new Map<string, string>();
                    
                    if (data.libraries) {
                        for (const libEntry of data.libraries) {
                            const libInfo = libEntry.library;
                            const libName = libInfo?.name;
                            const latestVersion = libEntry.release?.version;
                            
                            if (libName && latestVersion) {
                                outdated.set(libName, latestVersion);
                            }
                        }
                    }
                    
                    resolve(outdated);
                } catch (parseError) {
                    resolve(new Map());
                }
            });
        });
    }

    private saveToCache(libraries: Library[]): void {
        try {
            const cacheDir = path.dirname(this.cacheFile);
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }
            
            const cacheData = {
                libraries: libraries,
                timestamp: Date.now()
            };
            
            fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2));
        } catch (error) {
            console.error('Error saving cache:', error);
        }
    }

    public async refreshCache(): Promise<void> {
        try {
            vscode.window.showInformationMessage('Refreshing library cache...');
            
            // Delete existing cache file
            if (fs.existsSync(this.cacheFile)) {
                fs.unlinkSync(this.cacheFile);
            }
            
            // Fetch fresh data
            await this.fetchLibraries();
            vscode.window.showInformationMessage('Library cache refreshed successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Error refreshing cache: ${error}`);
        }
    }

    private runCommand(command: string): Promise<void> {
        return new Promise((resolve, reject) => {
            exec(command, {
                maxBuffer: Infinity // No buffer limit
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
}
