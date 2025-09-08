import * as vscode from 'vscode';
import { spawn, exec } from 'child_process';
import { ConfigManager } from './configManager';
import * as fs from 'fs';
import * as path from 'path';

export class ArduinoManager {
    private configManager: ConfigManager;
    private outputChannel: vscode.OutputChannel;
    private boardsCacheFile: string;
    private cacheExpiration: number = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    constructor(configManager: ConfigManager, context?: vscode.ExtensionContext) {
        this.configManager = configManager;
        this.outputChannel = vscode.window.createOutputChannel('Arduino Cursor');
        // Cache in extension's global storage directory
        if (context) {
            this.boardsCacheFile = path.join(context.globalStorageUri.fsPath, 'boards_cache.json');
        } else {
            // Fallback to temp directory
            this.boardsCacheFile = path.join(require('os').tmpdir(), 'arduino-cursor', 'boards_cache.json');
        }
    }

    public async upload(): Promise<void> {
        const config = this.configManager.getConfig();
        const currentDir = this.configManager.getCurrentDirectory();
        const arduinoCli = this.configManager.getArduinoCliPath();

        if (!currentDir) {
            vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
            return;
        }

        this.outputChannel.clear();
        this.outputChannel.show();

        try {
            // First compile
            this.outputChannel.appendLine('--- Compiling Arduino sketch ---');
            await this.runCommand(`${arduinoCli} compile --fqbn ${config.board} "${currentDir}"`, currentDir);
            
            // Then upload
            this.outputChannel.appendLine('--- Uploading to Arduino ---');
            await this.runCommand(`${arduinoCli} upload -p ${config.port} --fqbn ${config.board} "${currentDir}"`, currentDir);
            
            this.outputChannel.appendLine('--- Upload Complete ---');
            vscode.window.showInformationMessage('Arduino upload completed successfully!');
        } catch (error) {
            this.outputChannel.appendLine(`Error: ${error}`);
            vscode.window.showErrorMessage(`Upload failed: ${error}`);
        }
    }

    public async check(): Promise<void> {
        const config = this.configManager.getConfig();
        const currentDir = this.configManager.getCurrentDirectory();
        const arduinoCli = this.configManager.getArduinoCliPath();

        if (!currentDir) {
            vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
            return;
        }

        this.outputChannel.clear();
        this.outputChannel.show();

        try {
            this.outputChannel.appendLine('--- Checking Arduino code ---');
            await this.runCommand(`${arduinoCli} compile --fqbn ${config.board} "${currentDir}"`, currentDir);
            this.outputChannel.appendLine('--- Code checked successfully ---');
            vscode.window.showInformationMessage('Arduino code check completed successfully!');
        } catch (error) {
            this.outputChannel.appendLine(`Error: ${error}`);
            vscode.window.showErrorMessage(`Code check failed: ${error}`);
        }
    }

    public async monitor(): Promise<void> {
        const config = this.configManager.getConfig();
        const arduinoCli = this.configManager.getArduinoCliPath();

        const terminal = vscode.window.createTerminal({
            name: 'Arduino Serial Monitor',
            shellPath: arduinoCli,
            shellArgs: ['monitor', '-p', config.port, '-c', config.baudrate.toString()]
        });

        terminal.show();
    }

    public status(): void {
        const config = this.configManager.getConfig();
        const statusMessage = `Board: ${config.board}\nPort: ${config.port}\nBaudrate: ${config.baudrate}`;
        vscode.window.showInformationMessage(statusMessage);
    }

    public async selectBoard(): Promise<void> {
        try {
            const boards = await this.getAvailableBoards();
            if (boards.length === 0) {
                vscode.window.showErrorMessage('No Arduino boards found. Try refreshing the cache.');
                return;
            }

            const selectedBoard = await vscode.window.showQuickPick(boards, {
                placeHolder: 'Select Arduino Board',
                matchOnDescription: true
            });

            if (selectedBoard) {
                this.configManager.setBoard(selectedBoard.fqbn);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error selecting board: ${error}`);
        }
    }

    public async selectPort(): Promise<void> {
        try {
            // Show loading message
            vscode.window.showInformationMessage('Detecting Arduino ports...');
            
            const ports = await this.getAvailablePorts();
            if (ports.length === 0) {
                vscode.window.showErrorMessage('No connected COM ports found.');
                return;
            }

            const selectedPort = await vscode.window.showQuickPick(ports, {
                placeHolder: 'Select Arduino Port'
            });

            if (selectedPort) {
                this.configManager.setPort(selectedPort);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error getting ports: ${error}`);
        }
    }

    public async gui(): Promise<void> {
        // First select board, then port
        await this.selectBoard();
        await this.selectPort();
    }

    public async listBoards(): Promise<void> {
        try {
            const boards = await this.getAvailableBoards();
            const boardList = boards.map(board => `${board.name} (${board.fqbn})`).join('\n');
            
            this.outputChannel.clear();
            this.outputChannel.appendLine(`Available Arduino Boards (${boards.length} total):`);
            this.outputChannel.appendLine(boardList);
            this.outputChannel.show();
        } catch (error) {
            vscode.window.showErrorMessage(`Error listing boards: ${error}`);
        }
    }

    public async setBaudrate(): Promise<void> {
        const currentBaudrate = this.configManager.getConfig().baudrate;
        const baudrateInput = await vscode.window.showInputBox({
            prompt: 'Enter baudrate for serial monitor',
            value: currentBaudrate.toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num <= 0) {
                    return 'Please enter a valid positive number';
                }
                return null;
            }
        });

        if (baudrateInput) {
            this.configManager.setBaudrate(parseInt(baudrateInput));
        }
    }

    private async getAvailableBoards(): Promise<Array<{label: string, fqbn: string, name: string}>> {
        // Try to load from cache first
        const cachedBoards = this.loadBoardsFromCache();
        if (cachedBoards) {
            return cachedBoards;
        }

        // Fetch fresh data
        return await this.fetchBoards();
    }

    private loadBoardsFromCache(): Array<{label: string, fqbn: string, name: string}> | null {
        try {
            if (!fs.existsSync(this.boardsCacheFile)) {
                return null;
            }

            const stats = fs.statSync(this.boardsCacheFile);
            const now = Date.now();
            
            if (now - stats.mtime.getTime() > this.cacheExpiration) {
                return null; // Cache expired
            }

            const data = fs.readFileSync(this.boardsCacheFile, 'utf8');
            const cached = JSON.parse(data);
            
            // Validate cache structure
            if (cached && cached.boards && Array.isArray(cached.boards)) {
                vscode.window.showInformationMessage(`Loading ${cached.boards.length} boards from cache...`);
                return cached.boards;
            }
            
            return null;
        } catch (error) {
            console.error('Error loading boards cache:', error);
            return null;
        }
    }

    private async fetchBoards(): Promise<Array<{label: string, fqbn: string, name: string}>> {
        try {
            vscode.window.showInformationMessage('Fetching boards from arduino-cli...');
            
            const arduinoCli = this.configManager.getArduinoCliPath();
            const boards = await this.getAvailableBoardsStreaming(arduinoCli);

            // Save to cache
            this.saveBoardsToCache(boards);
            
            return boards;
        } catch (error) {
            vscode.window.showErrorMessage(`Error fetching boards: ${error}`);
            // Try to load from cache as fallback
            const cached = this.loadBoardsFromCache();
            if (cached) {
                vscode.window.showInformationMessage('Using cached board data...');
                return cached;
            }
            // Final fallback to common boards
            return this.getCommonBoards();
        }
    }

    private getCommonBoards(): Array<{label: string, fqbn: string, name: string}> {
        return [
            { label: 'Arduino Uno', fqbn: 'arduino:avr:uno', name: 'Arduino Uno' },
            { label: 'Arduino Nano', fqbn: 'arduino:avr:nano', name: 'Arduino Nano' },
            { label: 'Arduino Mega', fqbn: 'arduino:avr:mega', name: 'Arduino Mega' },
            { label: 'Arduino Leonardo', fqbn: 'arduino:avr:leonardo', name: 'Arduino Leonardo' },
            { label: 'Arduino Micro', fqbn: 'arduino:avr:micro', name: 'Arduino Micro' },
            { label: 'Arduino Pro Mini', fqbn: 'arduino:avr:pro', name: 'Arduino Pro Mini' },
            { label: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32', name: 'ESP32 Dev Module' },
            { label: 'ESP32-S3 Dev Module', fqbn: 'esp32:esp32:esp32s3', name: 'ESP32-S3 Dev Module' },
            { label: 'ESP8266 NodeMCU', fqbn: 'esp8266:esp8266:nodemcuv2', name: 'ESP8266 NodeMCU' },
            { label: 'ESP8266 Generic', fqbn: 'esp8266:esp8266:generic', name: 'ESP8266 Generic' },
            { label: 'Teensy 3.2', fqbn: 'teensy:avr:teensy32', name: 'Teensy 3.2' },
            { label: 'Teensy 4.0', fqbn: 'teensy:avr:teensy40', name: 'Teensy 4.0' }
        ];
    }

    private async getAvailablePorts(): Promise<string[]> {
        const arduinoCli = this.configManager.getArduinoCliPath();
        
        return new Promise((resolve, reject) => {
            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                reject(new Error('Port detection timeout - arduino-cli took too long to respond'));
            }, 10000); // 10 second timeout

            exec(`${arduinoCli} board list`, {
                maxBuffer: Infinity, // No buffer limit
                timeout: 8000 // 8 second timeout for the command itself
            }, (error, stdout, stderr) => {
                clearTimeout(timeout);
                
                if (error) {
                    // If arduino-cli fails, try to get common ports as fallback
                    const commonPorts = this.getCommonPorts();
                    if (commonPorts.length > 0) {
                        resolve(commonPorts);
                        return;
                    }
                    reject(error);
                    return;
                }

                const ports: string[] = [];
                const lines = stdout.split('\n');
                
                for (const line of lines) {
                    if (line.match(/^\/dev\/tty/) || line.match(/^COM/)) {
                        const port = line.match(/^(\S+)/)?.[1];
                        if (port) {
                            ports.push(port);
                        }
                    }
                }

                // If no ports found, try common ports as fallback
                if (ports.length === 0) {
                    const commonPorts = this.getCommonPorts();
                    resolve(commonPorts);
                } else {
                    resolve(ports);
                }
            });
        });
    }

    private getCommonPorts(): string[] {
        // Common Arduino ports as fallback
        const commonPorts = [
            'COM1', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'COM10',
            '/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyUSB0', '/dev/ttyUSB1',
            '/dev/cu.usbmodem*', '/dev/cu.usbserial*'
        ];
        return commonPorts;
    }

    private async getAvailableBoardsStreaming(arduinoCli: string): Promise<Array<{label: string, fqbn: string, name: string}>> {
        return new Promise((resolve, reject) => {
            exec(`${arduinoCli} board listall --format json`, {
                maxBuffer: Infinity // No buffer limit
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }

                try {
                    const data = JSON.parse(stdout);
                    const boards = data.boards || [];
                    
                    const boardList = boards
                        .filter((board: any) => board.fqbn && board.name)
                        .map((board: any) => ({
                            label: board.name,
                            fqbn: board.fqbn,
                            name: board.name
                        }));

                    resolve(boardList);
                } catch (parseError) {
                    reject(parseError);
                }
            });
        });
    }

    private saveBoardsToCache(boards: Array<{label: string, fqbn: string, name: string}>): void {
        try {
            const cacheDir = path.dirname(this.boardsCacheFile);
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }
            
            const cacheData = {
                boards: boards,
                timestamp: Date.now()
            };
            
            fs.writeFileSync(this.boardsCacheFile, JSON.stringify(cacheData, null, 2));
        } catch (error) {
            console.error('Error saving boards cache:', error);
        }
    }

    public async refreshBoardsCache(): Promise<void> {
        try {
            vscode.window.showInformationMessage('Refreshing boards cache...');
            
            // Delete existing cache file
            if (fs.existsSync(this.boardsCacheFile)) {
                fs.unlinkSync(this.boardsCacheFile);
            }
            
            // Fetch fresh data
            await this.fetchBoards();
            vscode.window.showInformationMessage('Boards cache refreshed successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Error refreshing boards cache: ${error}`);
        }
    }

    private runCommand(command: string, cwd: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const child = spawn('cmd', ['/c', command], {
                cwd: cwd,
                shell: true
            });

            child.stdout?.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            child.stderr?.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Command failed with exit code ${code}`));
                }
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }
}
