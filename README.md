# Reference Counter for VSCode

[![Version](https://img.shields.io/visual-studio-marketplace/v/gosvig123.css-class-counter)](https://marketplace.visualstudio.com/items?itemName=gosvig123.css-class-counter)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/gosvig123.css-class-counter)](https://marketplace.visualstudio.com/items?itemName=gosvig123.css-class-counter)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/gosvig123.css-class-counter)](https://marketplace.visualstudio.com/items?itemName=gosvig123.css-class-counter&ssr=false#review-details)
[![GitHub stars](https://img.shields.io/github/stars/gosvig123/reference_count_extension?style=social)](https://github.com/gosvig123/reference_count_extension)

<a href="https://www.buymeacoffee.com/gosvig123" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## Why Use Reference Counter?

- **Identify Dead Code**: Find unused functions and classes that can be safely removed
- **Understand Impact**: See how widely used a function is before refactoring it
- **Improve Code Quality**: Maintain a cleaner codebase by removing unused code
- **Save Time**: No more manual searches to find all references

This extension provides two powerful features:

1. Displaying the number of times a function, class, or method is called directly in your editor
2. Identifying unused symbols in your workspace with a dedicated view

## Screenshots

### Inline Reference Counts
![Inline Reference Counts](https://raw.githubusercontent.com/gosvig123/reference_count_extension/main/inline_unused.png)

### Unused Symbols View
![Unused Symbols View](https://raw.githubusercontent.com/gosvig123/reference_count_extension/main/workspace_unused.png)


## Features

- **Inline Reference Counts**: See how many times each function, class, or method is used
- **Unused Symbols View**: Quickly identify unused code in your workspace
- **Multi-language Support**: Works with Python, JavaScript, TypeScript, and more
- **Smart Import Handling**: Excludes import statements by default for more accurate counts
- **Performance Optimized**: Automatically excludes common folders like node_modules and build directories
- **Highly Configurable**: Customize to fit your workflow
- **Modular Architecture**: Clean, maintainable codebase with clear separation of concerns

### New in Version 0.3.3

- **Enhanced Architecture**: Restructured code to be more modular and maintainable
- **Improved Import Detection**: Better handling of import statements for more accurate reference counting
- **Real-time Config Updates**: Configuration changes are now applied immediately without requiring a restart
- **Performance Optimizations**: Improved caching and reduced memory usage
- **Updated Dependencies**: Now using latest versions of webpack and TypeScript

## Usage

1. Open any supported file in your workspace
2. Reference counts will automatically appear next to functions, classes, and methods
3. Open the "Unused Symbols" view in the Explorer sidebar
4. Click the "Find Unused Symbols" button (or run the command from the command palette) to scan your workspace
5. Click on any unused symbol to navigate directly to its location

## Configuration

Customize the extension through VS Code settings:

```json
// settings.json
{
  // File extensions to include in reference counting
  "referenceCounter.fileExtensions": ["py", "js", "jsx", "ts", "tsx"],

  // Patterns to exclude from scanning (improves performance)
  "referenceCounter.excludePatterns": [
    "node_modules",
    ".next",
    "dist",
    "build",
    "out",
    ".git",
    "coverage"
  ],

  // Whether to include import statements in reference count
  "referenceCounter.includeImports": false,

  // Use a more compact display for reference counts
  "referenceCounter.minimalisticDecorations": true
}
```

All configuration changes are applied in real-time without requiring a restart.

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
   # Development build
   npm run compile
   
   # Production build
   npm run package
   
   # Watch mode (auto-rebuilds on changes)
   npm run watch
   
   # Run linter
   npm run lint
   
   # Run tests
   npm run test
   
   # Press F5 in VS Code to launch the extension in debug mode
   ```

The project uses TypeScript with target ES2022, module Node16, and includes support for JSX React style.

## Feedback and Support

If you like this extension, please:

- ⭐ Star the [GitHub repository](https://github.com/gosvig123/reference_count_extension)
- ✍️ Rate and review on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=gosvig123.css-class-counter&ssr=false#review-details)
- 📣 Share it with your friends and colleagues
- ☕ Support development via [Buy Me A Coffee](https://www.buymeacoffee.com/gosvig123)

For support, please [open an issue](https://github.com/gosvig123/reference_count_extension/issues) on GitHub.

## Connect with the Developer

- 👨‍💻 [LinkedIn](https://www.linkedin.com/in/kristian-gosvig/)
- 🌐 GitHub: [@gosvig123](https://github.com/gosvig123)

## License

This extension is licensed under the [MIT License](LICENSE).
