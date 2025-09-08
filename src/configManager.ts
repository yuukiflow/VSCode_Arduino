import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface ArduinoConfig {
    board: string;
    port: string;
    baudrate: number;
}

export class ConfigManager {
    private context: vscode.ExtensionContext;
    private config: ArduinoConfig;
    private configFile: string;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.configFile = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', '.arduino_config.json');
        
        // Initialize with defaults
        this.config = {
            board: vscode.workspace.getConfiguration('arduino-cursor').get('defaultBoard', 'arduino:avr:uno'),
            port: vscode.workspace.getConfiguration('arduino-cursor').get('defaultPort', '/dev/ttyACM0'),
            baudrate: vscode.workspace.getConfiguration('arduino-cursor').get('defaultBaudrate', 115200)
        };

        this.loadConfig();
    }

    public getConfig(): ArduinoConfig {
        return { ...this.config };
    }

    public setBoard(board: string): void {
        this.config.board = board.trim();
        this.saveConfig();
        vscode.window.showInformationMessage(`Board set to: ${board}`);
    }

    public setPort(port: string): void {
        this.config.port = port.trim();
        this.saveConfig();
        vscode.window.showInformationMessage(`Port set to: ${port}`);
    }

    public setBaudrate(baudrate: number): void {
        this.config.baudrate = baudrate;
        this.saveConfig();
        vscode.window.showInformationMessage(`Baudrate set to: ${baudrate}`);
    }

    public loadConfig(): void {
        try {
            if (fs.existsSync(this.configFile)) {
                const data = fs.readFileSync(this.configFile, 'utf8');
                const loadedConfig = JSON.parse(data);
                
                this.config.board = loadedConfig.board || this.config.board;
                this.config.port = loadedConfig.port || this.config.port;
                this.config.baudrate = loadedConfig.baudrate || this.config.baudrate;
                
                vscode.window.showInformationMessage(`Config loaded from: ${this.configFile}`);
            } else {
                this.createDefaultConfig();
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error loading config: ${error}`);
            this.createDefaultConfig();
        }
    }

    private saveConfig(): void {
        try {
            const configDir = path.dirname(this.configFile);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
        } catch (error) {
            vscode.window.showErrorMessage(`Error saving config: ${error}`);
        }
    }

    private createDefaultConfig(): void {
        vscode.window.showInformationMessage('Config file not found. Creating with default settings.');
        this.saveConfig();
    }

    public getArduinoCliPath(): string {
        return vscode.workspace.getConfiguration('arduino-cursor').get('arduinoCliPath', 'arduino-cli');
    }

    public getCurrentDirectory(): string {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    }
}
