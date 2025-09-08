import * as vscode from 'vscode';
import { ArduinoManager } from './arduinoManager';
import { LibraryManager } from './libraryManager';
import { ConfigManager } from './configManager';

let arduinoManager: ArduinoManager;
let libraryManager: LibraryManager;
let configManager: ConfigManager;
let statusBarItems: vscode.StatusBarItem[] = [];

export function activate(context: vscode.ExtensionContext) {
    console.log('Arduino Cursor extension is now active!');

    // Initialize managers
    configManager = new ConfigManager(context);
    arduinoManager = new ArduinoManager(configManager, context);
    libraryManager = new LibraryManager(configManager, context);

    // Register commands
    const commands = [
        vscode.commands.registerCommand('arduino-cursor.upload', () => arduinoManager.upload()),
        vscode.commands.registerCommand('arduino-cursor.check', () => arduinoManager.check()),
        vscode.commands.registerCommand('arduino-cursor.monitor', () => arduinoManager.monitor()),
        vscode.commands.registerCommand('arduino-cursor.status', () => arduinoManager.status()),
        vscode.commands.registerCommand('arduino-cursor.selectBoard', () => arduinoManager.selectBoard()),
        vscode.commands.registerCommand('arduino-cursor.selectPort', () => arduinoManager.selectPort()),
        vscode.commands.registerCommand('arduino-cursor.gui', () => arduinoManager.gui()),
        vscode.commands.registerCommand('arduino-cursor.libraryManager', () => libraryManager.openLibraryManager()),
        vscode.commands.registerCommand('arduino-cursor.refreshLibraryCache', () => libraryManager.refreshCache()),
        vscode.commands.registerCommand('arduino-cursor.refreshBoardsCache', () => arduinoManager.refreshBoardsCache()),
        vscode.commands.registerCommand('arduino-cursor.listBoards', () => arduinoManager.listBoards()),
        vscode.commands.registerCommand('arduino-cursor.setBaudrate', () => arduinoManager.setBaudrate())
    ];

    // Add all commands to context
    commands.forEach(command => context.subscriptions.push(command));

    // Create status bar items
    createStatusBarItems(context);

    // Set up file type detection
    const disposable = vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === 'arduino' || document.fileName.endsWith('.ino')) {
            // Arduino file opened, ensure configuration is loaded
            configManager.loadConfig();
            updateStatusBarVisibility(true);
        }
    });

    // Set up active editor change detection
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && (editor.document.languageId === 'arduino' || editor.document.fileName.endsWith('.ino'))) {
            updateStatusBarVisibility(true);
        } else {
            updateStatusBarVisibility(false);
        }
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(editorChangeDisposable);
}

function createStatusBarItems(context: vscode.ExtensionContext) {
    // Upload button
    const uploadItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    uploadItem.text = "$(upload) Upload";
    uploadItem.tooltip = "Upload Arduino sketch";
    uploadItem.command = 'arduino-cursor.upload';
    uploadItem.show();
    statusBarItems.push(uploadItem);

    // Check/Compile button
    const checkItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    checkItem.text = "$(check) Check";
    checkItem.tooltip = "Check/Compile Arduino code";
    checkItem.command = 'arduino-cursor.check';
    checkItem.show();
    statusBarItems.push(checkItem);

    // Monitor button
    const monitorItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
    monitorItem.text = "$(terminal) Monitor";
    monitorItem.tooltip = "Open Serial Monitor";
    monitorItem.command = 'arduino-cursor.monitor';
    monitorItem.show();
    statusBarItems.push(monitorItem);

    // Status button
    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 97);
    statusItem.text = "$(info) Status";
    statusItem.tooltip = "Show Arduino status";
    statusItem.command = 'arduino-cursor.status';
    statusItem.show();
    statusBarItems.push(statusItem);

    // Board selection button
    const boardItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 96);
    boardItem.text = "$(circuit-board) Board";
    boardItem.tooltip = "Select Arduino Board";
    boardItem.command = 'arduino-cursor.selectBoard';
    boardItem.show();
    statusBarItems.push(boardItem);

    // Port selection button
    const portItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 95);
    portItem.text = "$(plug) Port";
    portItem.tooltip = "Select Arduino Port";
    portItem.command = 'arduino-cursor.selectPort';
    portItem.show();
    statusBarItems.push(portItem);

    // Library Manager button
    const libItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 94);
    libItem.text = "$(library) Libraries";
    libItem.tooltip = "Library Manager";
    libItem.command = 'arduino-cursor.libraryManager';
    libItem.show();
    statusBarItems.push(libItem);

    // GUI button
    const guiItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 93);
    guiItem.text = "$(gear) Setup";
    guiItem.tooltip = "Arduino GUI (Board & Port Selection)";
    guiItem.command = 'arduino-cursor.gui';
    guiItem.show();
    statusBarItems.push(guiItem);

    // Add all items to context subscriptions
    statusBarItems.forEach(item => context.subscriptions.push(item));

    // Initially hide the toolbar
    updateStatusBarVisibility(false);
}

function updateStatusBarVisibility(visible: boolean) {
    statusBarItems.forEach(item => {
        if (visible) {
            item.show();
        } else {
            item.hide();
        }
    });
}

export function deactivate() {
    // Cleanup if needed
    statusBarItems.forEach(item => item.dispose());
}
