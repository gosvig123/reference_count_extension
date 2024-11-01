# Reference Counter

Reference Counter is a Visual Studio Code extension that counts and displays the usage of functions, methods, and classes in your code.

## Features

This extension provides the following features:

- Counts references and usages of functions, methods, and classes
- Shows reference counts inline next to each definition
- Color-coded indicators (gray for active references, red for unused)
- Real-time updates as you edit your code
- Support for multiple programming languages

## Requirements

- Visual Studio Code version 1.91.0 or higher
- No additional dependencies required

## Extension Settings

Currently, this extension works automatically for supported file types without requiring any configuration.

## Supported Languages

The following file types are supported:
- Python (.py)
- JavaScript (.js)
- TypeScript (.ts)
- React (JSX/TSX)

## Features in Detail

- **Inline Reference Counting**: Displays the number of references next to each function or method definition
- **Class Support**: Tracks both class-level references and individual method usage
- **Real-time Updates**: Reference counts update automatically as you edit your code
- **Visual Indicators**:
  - Gray numbers indicate active references
  - Red "No references" warning for unused functions

## Known Issues

- Performance may degrade with very large projects
- Some complex function definitions or usages may not be correctly identified
- Reference counting might not be accurate for certain dynamic language features

## Release Notes

### 0.1.0

- Enhanced class and method reference tracking
- Improved visual indicators for unused functions
- Support for multiple programming languages
- Real-time reference counting updates

## Development

This project is open source and available on GitHub. For more information:
- Repository: [reference_count_extension](https://github.com/gosvig123/reference_count_extension)
- License: MIT

## For More Information

* [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
* [VS Code API Documentation](https://code.visualstudio.com/api)

**Enjoy tracking your code references!**