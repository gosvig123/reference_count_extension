# Reference Counter for VSCode

[![Version](https://img.shields.io/visual-studio-marketplace/v/gosvig123.css-class-counter)](https://marketplace.visualstudio.com/items?itemName=gosvig123.css-class-counter)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/gosvig123.css-class-counter)](https://marketplace.visualstudio.com/items?itemName=gosvig123.css-class-counter)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/gosvig123.css-class-counter)](https://marketplace.visualstudio.com/items?itemName=gosvig123.css-class-counter&ssr=false#review-details)
[![GitHub stars](https://img.shields.io/github/stars/gosvig123/reference_count_extension?style=social)](https://github.com/gosvig123/reference_count_extension)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow)](https://www.buymeacoffee.com/kristiangosvig)

This is an open source extension for Visual Studio Code that helps you understand your codebase by:

1. Displaying the number of times a function, class, or method is called directly in your editor
2. Identifying unused symbols in your workspace with a dedicated view

## Screenshots

### Inline Reference Counts
![Inline Reference Counts](https://raw.githubusercontent.com/gosvig123/reference_count_extension/main/inline_unused.png)

### Unused Symbols View
![Unused Symbols View](https://raw.githubusercontent.com/gosvig123/reference_count_extension/main/workspace_unused.png)


## Why Use Reference Counter?

- **Identify Dead Code**: Find unused functions and classes that can be safely removed
- **Understand Impact**: See how widely used a function is before refactoring it
- **Improve Code Quality**: Maintain a cleaner codebase by removing unused code
- **Save Time**: No more manual searches to find all references


## Features

- **Inline Reference Counts**: See how many times each function, class, or method is used
- **Unused Symbols View**: Quickly identify unused code in your workspace
- **Multi-language Support**: Works with Python, JavaScript, TypeScript, and more
- **Smart Import Handling**: Excludes import statements by default for more accurate counts
- **Performance Optimized**: Automatically excludes common folders like node_modules and build directories
- **Highly Configurable**: Customize to fit your workflow

### New in Latest Version

- **Unused Symbols Explorer**: New dedicated view in the Explorer sidebar to find unused code
- **Performance Improvements**: Automatically excludes node_modules, .next, dist, and other build folders
- **Improved Symbol Detection**: Better handling of nested symbols and class methods
- **Enhanced Logging**: More detailed logging for easier troubleshooting

## Installation

Install directly from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=gosvig123.css-class-counter) or search for "Reference Counter" in the Extensions view (Ctrl+Shift+X).

## Usage

1. Open any supported file in your workspace
2. Reference counts will automatically appear next to functions, classes, and methods
3. Open the "Unused Symbols" view in the Explorer sidebar to see unused code
4. Click on any unused symbol to navigate directly to its location

## Configuration

Customize the extension through VS Code settings:

```json
// settings.json
{
  // File extensions to include in reference counting
  "referenceCounter.fileExtensions": ["py", "js", "jsx", "ts", "tsx"],

  // Patterns to exclude from scanning (improves performance)
  "referenceCounter.excludePatterns": ["node_modules", ".next", "dist", "build"],

  // Whether to include import statements in reference count
  "referenceCounter.includeImports": false,

  // Use a more compact display for reference counts
  "referenceCounter.minimalisticDecorations": true
}
```

## Contributing

We welcome contributions from the community! Reference Counter is an open-source project that gets better with your help.

### Ways to Contribute

- **Report Bugs**: Found an issue? Let us know in the [GitHub Issues](https://github.com/gosvig123/reference_count_extension/issues)
- **Suggest Features**: Have an idea? We'd love to hear it!
- **Submit Pull Requests**: Fixed a bug or added a feature? Submit a PR!
- **Improve Documentation**: Help make our docs better for everyone

### Development Setup

1. Clone the repository
   ```bash
   git clone https://github.com/gosvig123/reference_count_extension.git
   cd reference_count_extension
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Build and run
   ```bash
   npm run compile
   # Press F5 in VS Code to launch the extension in debug mode
   ```

## Feedback and Support

If you like this extension, please:

- ⭐ Star the [GitHub repository](https://github.com/gosvig123/reference_count_extension)
- ✍️ Rate and review on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=gosvig123.css-class-counter&ssr=false#review-details)
- 📣 Share it with your friends and colleagues
- ☕ Support development via [Buy Me A Coffee](https://www.buymeacoffee.com/kristiangosvig)

For support, please [open an issue](https://github.com/gosvig123/reference_count_extension/issues) on GitHub.

## Connect with the Developer

- 👨‍💻 [LinkedIn](https://www.linkedin.com/in/kristian-gosvig/)
- 🌐 GitHub: [@gosvig123](https://github.com/gosvig123)

## License

This extension is licensed under the [MIT License](LICENSE).