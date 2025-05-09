# Reference Counter for VSCode

[![Version](https://img.shields.io/visual-studio-marketplace/v/gosvig123.css-class-counter)](https://marketplace.visualstudio.com/items?itemName=gosvig123.css-class-counter)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/gosvig123.css-class-counter)](https://marketplace.visualstudio.com/items?itemName=gosvig123.css-class-counter)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/gosvig123.css-class-counter)](https://marketplace.visualstudio.com/items?itemName=gosvig123.css-class-counter&ssr=false#review-details)
[![GitHub stars](https://img.shields.io/github/stars/gosvig123/reference_count_extension?style=social)](https://github.com/gosvig123/reference_count_extension)

<a href="https://www.buymeacoffee.com/gosvig123" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

This Visual Studio Code extension counts and displays code reference usage directly in your editor. Identify unused symbols and make informed refactoring decisions.

## Why Use Reference Counter?

- **Identify Dead Code**: Find unused functions/classes for safe removal
- **Understand Impact**: See function usage before refactoring
- **Improve Code Quality**: Maintain cleaner codebase
- **Save Time**: Eliminate manual reference searches

## Features

- **Inline Reference Counts**: Display usage counts next to definitions
- **Unused Symbols View**: Dedicated sidebar for zero-reference symbols
- **Multi-language Support**: Python, JavaScript, TypeScript
- **Performance Optimized**: Auto-excludes node_modules/build folders
- **Real-time Updates**: Config changes apply immediately
- **Smart Import Handling**: Excludes imports by default (configurable)

![Inline Reference Counts](https://raw.githubusercontent.com/gosvig123/reference_count_extension/main/inline_unused.png)
![Unused Symbols View](https://raw.githubusercontent.com/gosvig123/reference_count_extension/main/workspace_unused.png)

## Configuration

```json
{
  "referenceCounter.fileExtensions": ["py", "js", "jsx", "ts", "tsx"],
  "referenceCounter.excludePatterns": [
    "node_modules",
    ".next",
    "dist",
    "build"
  ],
  "referenceCounter.includeImports": false,
  "referenceCounter.minimalisticDecorations": true
}
```

| Setting                                   | Description                                                                 | Default Value               |
|-------------------------------------------|-----------------------------------------------------------------------------|-----------------------------|
| `referenceCounter.fileExtensions`         | File extensions to include                                                  | `["py", "js", "jsx", "ts", "tsx"]` |
| `referenceCounter.excludePatterns`        | Glob patterns to exclude                                                    | Common build/node_modules   |
| `referenceCounter.includeImports`         | Count import statements as references                                       | `false`                     |
| `referenceCounter.minimalisticDecorations`| Use compact reference display                                               | `true`                      |

## Development Setup

```bash
git clone https://github.com/gosvig123/reference_count_extension.git
cd reference_count_extension
npm install
npm run compile
```

**Commands:**
- `npm run package`: Production build
- `npm run watch`: Auto-rebuild on changes
- `npm run lint`: Run linter
- `npm run test`: Run tests

## Contributing

We welcome contributions! Please:
- Report bugs via [GitHub Issues](https://github.com/gosvig123/reference_count_extension/issues)
- Suggest new features
- Submit PRs for improvements
- Improve documentation

## License

MIT Licensed - See [LICENSE](LICENSE) for details.