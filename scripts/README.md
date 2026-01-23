# Scripts

Utility scripts for managing Claude Code setup.

## install-official-plugins.sh

Install plugins from [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official).

### Usage

```bash
# Install recommended plugins (Boris's setup)
./install-official-plugins.sh

# Install all official plugins
./install-official-plugins.sh --all

# Install specific plugin
./install-official-plugins.sh code-simplifier

# List available plugins
./install-official-plugins.sh --list
```

### Recommended Plugins (Boris's Setup)

| Plugin | Description |
|--------|-------------|
| `code-simplifier` | Simplifies code for clarity and maintainability |
| `ralph-loop` | Long-running task validation (Stop hooks) |
| `commit-commands` | Git commit automation |
| `code-review` | Code review assistance |

### All Official Plugins

Run `./install-official-plugins.sh --list` to see all 27 available plugins including:
- LSP integrations (TypeScript, Python, Go, Rust, etc.)
- Development tools (plugin-dev, feature-dev, pr-review-toolkit)
- Output styles (explanatory, learning)
- Security guidance
