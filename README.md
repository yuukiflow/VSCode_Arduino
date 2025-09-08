# Arduino Cursor

A Cursor extension that provides Arduino IDE-like functionality directly in your editor. This extension integrates Arduino development tools with Cursor, offering a seamless development experience for Arduino projects.

## Features

- Arduino project compilation and verification
- Code upload to Arduino boards
- Serial monitor with terminal integration
- Board and port management with GUI selection
- Advanced library management with visual indicators
  - Visual indicators for installed libraries (✅)
  - Update detection and management (🔄)
  - Cached library data for faster loading
- Real-time status monitoring
- Persistent configuration storage

## Requirements

- [arduino-cli](https://arduino.github.io/arduino-cli/) (latest stable version)
- [arduino-language-server](https://github.com/arduino/arduino-language-server) (optional, for LSP support)
- [clangd](https://clangd.llvm.org/) (optional, for LSP support)

## Installation

1. Install the extension from the Cursor marketplace or load it from source
2. Ensure `arduino-cli` is installed and available in your PATH
3. Open an Arduino project folder in Cursor

## Usage

### Commands

All commands are available through the Command Palette (`Ctrl+Shift+P`) and can be accessed by typing "Arduino":

| Command | Description |
|---------|-------------|
| `Arduino: Upload to Arduino` | Upload sketch to board |
| `Arduino: Check/Compile Arduino Code` | Compile and verify the current sketch |
| `Arduino: Open Serial Monitor` | Open serial monitor in a terminal |
| `Arduino: Show Arduino Status` | Display current board, port, and baudrate status |
| `Arduino: Library Manager` | Open library manager with visual indicators |
| `Arduino: Arduino GUI (Board & Port Selection)` | Open GUI for setting board and port |
| `Arduino: Select Arduino Board` | List available boards |
| `Arduino: Select Arduino Port` | List available ports |
| `Arduino: List Available Boards` | Show all available boards in output |
| `Arduino: Set Serial Monitor Baudrate` | Set baudrate for serial monitor |

### Configuration

The extension automatically creates and manages a `.arduino_config.json` file in your project directory to store:
- Board type (FQBN)
- Port selection
- Baudrate settings

### Settings

You can configure the extension through Cursor's settings:

- `arduino-cursor.defaultBoard`: Default Arduino board FQBN (default: "arduino:avr:uno")
- `arduino-cursor.defaultPort`: Default Arduino port (default: "/dev/ttyACM0")
- `arduino-cursor.defaultBaudrate`: Default serial monitor baudrate (default: 115200)
- `arduino-cursor.arduinoCliPath`: Path to arduino-cli executable (default: "arduino-cli")

### Library Manager

The library manager provides a visual interface with the following features:
- Visual indicators for installed libraries (✅)
- Update detection for outdated libraries (🔄)
- One-click installation and updates
- Cached library data for improved performance
- Search and filter capabilities

### Serial Monitor

The serial monitor opens in a dedicated terminal with the configured port and baudrate. You can interact with your Arduino directly through this terminal.

## Getting Started

1. Open an Arduino project folder in Cursor
2. Use the Command Palette (`Ctrl+Shift+P`) and search for "Arduino: Arduino GUI" to select your Arduino board and port
3. Write your Arduino code in `.ino` files
4. Use the Command Palette to access "Arduino: Check/Compile Arduino Code" to check your code
5. Use the Command Palette to access "Arduino: Upload to Arduino" to upload to your Arduino
6. Use the Command Palette to access "Arduino: Open Serial Monitor" to open the serial monitor

## Troubleshooting

### Arduino CLI Not Found
Make sure `arduino-cli` is installed and available in your system PATH. You can verify this by running `arduino-cli version` in a terminal.

### Port Not Found
- Make sure your Arduino is connected via USB
- Check that the correct drivers are installed
- Try using the "Select Arduino Port" command to see available ports

### Board Not Found
- Make sure you have the correct board package installed
- Use the "Select Arduino Board" command to see available boards
- Install missing board packages using `arduino-cli core install <package>`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is completely free and open source. You can do whatever you want with the code:
- Use it for any purpose
- Modify it however you want
- Share it with anyone
- Use it commercially
- Use it privately

No attribution or license text is required. Feel free to use this code in any way that helps you.
