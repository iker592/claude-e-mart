#!/bin/bash
# Install/update plugins from anthropics/claude-plugins-official
#
# Usage:
#   ./install-official-plugins.sh                    # Install recommended plugins
#   ./install-official-plugins.sh --all              # Install all plugins
#   ./install-official-plugins.sh code-simplifier    # Install specific plugin
#   ./install-official-plugins.sh --list             # List available plugins

set -e

REPO="anthropics/claude-plugins-official"
REPO_URL="https://github.com/$REPO"
RAW_URL="https://raw.githubusercontent.com/$REPO/main/plugins"

# Boris's recommended plugins
RECOMMENDED=(
    "code-simplifier"
    "ralph-loop"
    "commit-commands"
    "code-review"
)

# All available plugins (as of Jan 2026)
ALL_PLUGINS=(
    "agent-sdk-dev"
    "clangd-lsp"
    "claude-code-setup"
    "claude-md-management"
    "code-review"
    "code-simplifier"
    "commit-commands"
    "csharp-lsp"
    "example-plugin"
    "explanatory-output-style"
    "feature-dev"
    "frontend-design"
    "gopls-lsp"
    "hookify"
    "jdtls-lsp"
    "kotlin-lsp"
    "learning-output-style"
    "lua-lsp"
    "php-lsp"
    "plugin-dev"
    "pr-review-toolkit"
    "pyright-lsp"
    "ralph-loop"
    "rust-analyzer-lsp"
    "security-guidance"
    "swift-lsp"
    "typescript-lsp"
)

print_help() {
    echo "Install plugins from anthropics/claude-plugins-official"
    echo ""
    echo "Usage:"
    echo "  $0                      Install recommended plugins (Boris's setup)"
    echo "  $0 --all                Install all official plugins"
    echo "  $0 --list               List available plugins"
    echo "  $0 <plugin-name>        Install specific plugin"
    echo "  $0 <p1> <p2> ...        Install multiple plugins"
    echo ""
    echo "Recommended plugins:"
    for p in "${RECOMMENDED[@]}"; do
        echo "  - $p"
    done
}

list_plugins() {
    echo "Available official plugins ($REPO):"
    echo ""
    for p in "${ALL_PLUGINS[@]}"; do
        if [[ " ${RECOMMENDED[*]} " =~ " $p " ]]; then
            echo "  ✓ $p (recommended)"
        else
            echo "    $p"
        fi
    done
    echo ""
    echo "Install with: $0 <plugin-name>"
}

install_plugin() {
    local plugin="$1"
    echo "Installing $plugin..."

    # Use claude CLI to install from official directory
    if command -v claude &> /dev/null; then
        claude /plugin install "$plugin@claude-plugins-official" 2>/dev/null || {
            echo "  Note: You may need to install manually via /plugin in Claude Code"
            echo "  Run: /plugin install $plugin@claude-plugins-official"
        }
    else
        echo "  Claude CLI not found. Install manually:"
        echo "  Run: /plugin install $plugin@claude-plugins-official"
    fi

    echo "  ✓ $plugin"
}

# Parse arguments
case "${1:-}" in
    -h|--help)
        print_help
        exit 0
        ;;
    --list)
        list_plugins
        exit 0
        ;;
    --all)
        echo "Installing all official plugins..."
        echo ""
        for plugin in "${ALL_PLUGINS[@]}"; do
            install_plugin "$plugin"
        done
        ;;
    "")
        echo "Installing recommended plugins (Boris's setup)..."
        echo ""
        for plugin in "${RECOMMENDED[@]}"; do
            install_plugin "$plugin"
        done
        ;;
    *)
        # Install specific plugins
        for plugin in "$@"; do
            if [[ " ${ALL_PLUGINS[*]} " =~ " $plugin " ]]; then
                install_plugin "$plugin"
            else
                echo "Warning: Unknown plugin '$plugin'"
                echo "Run '$0 --list' to see available plugins"
            fi
        done
        ;;
esac

echo ""
echo "Done! Restart Claude Code to load new plugins."
echo ""
echo "Verify with: /plugin"
