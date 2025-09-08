# Installing the Arduino Cursor Extension

## Method 1: Build from Source (Recommended)

1. **Install Node.js** (if not already installed):
   - Download from https://nodejs.org/
   - Make sure npm is available in your PATH

2. **Build the extension**:
   ```bash
   cd CursorExtension
   npm install
   npm run build
   ```
   
   Or on Windows, simply double-click `build.bat`

3. **Install the VSIX file**:
   - The build process will create a `.vsix` file (e.g., `arduino-cursor-1.0.0.vsix`)
   - In Cursor, go to Extensions (Ctrl+Shift+X)
   - Click the "..." menu in the Extensions panel
   - Select "Install from VSIX..."
   - Choose the generated `.vsix` file

## Method 2: Manual Installation

If you prefer to install manually:

1. **Install dependencies**:
   ```bash
   cd CursorExtension
   npm install
   ```

2. **Compile TypeScript**:
   ```bash
   npm run compile
   ```

3. **Package the extension**:
   ```bash
   npx vsce package
   ```

4. **Install the VSIX**:
   - Follow step 3 from Method 1

## Troubleshooting

### Node.js not found
Make sure Node.js is installed and available in your system PATH. You can verify by running `node --version` in a terminal.

### npm not found
Make sure npm is installed with Node.js. You can verify by running `npm --version` in a terminal.

### Build fails
- Make sure you're in the CursorExtension directory
- Try deleting `node_modules` folder and running `npm install` again
- Check that all files are present in the src/ directory

### VSIX installation fails
- Make sure the VSIX file was created successfully
- Try restarting Cursor after installation
- Check Cursor's developer console for any error messages

## After Installation

1. Open an Arduino project folder in Cursor
2. Use `Ctrl+Alt+G` to configure your Arduino board and port
3. Start coding and use the keyboard shortcuts:
   - `Ctrl+Alt+C` - Check/Compile
   - `Ctrl+Alt+U` - Upload
   - `Ctrl+Alt+M` - Serial Monitor
   - `Ctrl+Alt+L` - Library Manager
