#!/bin/bash
# Link universal AI config to a project
#
# Usage: ./link-ai.sh /path/to/project [--tools claude,cursor,copilot,windsurf,cline]
#
# This creates symlinks so all AI tools share the same instructions.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_PATH="${1:-.}"
TOOLS="${2:-all}"

# Resolve to absolute path
if [[ "$PROJECT_PATH" != /* ]]; then
    PROJECT_PATH="$(cd "$PROJECT_PATH" 2>/dev/null && pwd)" || {
        echo "Error: Directory '$1' does not exist"
        exit 1
    }
fi

echo "Linking AI config to: $PROJECT_PATH"
echo ""

# Helper function to create symlink
link_file() {
    local source="$1"
    local target="$2"
    local target_dir="$(dirname "$target")"

    # Create parent directory if needed
    if [[ ! -d "$target_dir" ]]; then
        mkdir -p "$target_dir"
        echo "  Created $target_dir/"
    fi

    if [[ -e "$target" ]] || [[ -L "$target" ]]; then
        if [[ -L "$target" ]]; then
            rm "$target"
            ln -s "$source" "$target"
            echo "  ✓ Updated $(basename "$target")"
        else
            echo "  ⚠ Skipped $(basename "$target") (file exists, not a symlink)"
        fi
    else
        ln -s "$source" "$target"
        echo "  ✓ Linked $(basename "$target")"
    fi
}

# Claude Code
if [[ "$TOOLS" == "all" ]] || [[ "$TOOLS" == *"claude"* ]]; then
    echo "Claude Code:"
    link_file "$SCRIPT_DIR/AGENTS.md" "$PROJECT_PATH/CLAUDE.md"
    mkdir -p "$PROJECT_PATH/.claude"
    link_file "$SCRIPT_DIR/settings.json" "$PROJECT_PATH/.claude/settings.json"
    link_file "$SCRIPT_DIR/mcp.json" "$PROJECT_PATH/.mcp.json"
    echo ""
fi

# Cursor
if [[ "$TOOLS" == "all" ]] || [[ "$TOOLS" == *"cursor"* ]]; then
    echo "Cursor:"
    link_file "$SCRIPT_DIR/AGENTS.md" "$PROJECT_PATH/.cursorrules"
    mkdir -p "$PROJECT_PATH/.cursor"
    link_file "$SCRIPT_DIR/mcp.json" "$PROJECT_PATH/.cursor/mcp.json"
    echo ""
fi

# GitHub Copilot
if [[ "$TOOLS" == "all" ]] || [[ "$TOOLS" == *"copilot"* ]]; then
    echo "GitHub Copilot:"
    link_file "$SCRIPT_DIR/AGENTS.md" "$PROJECT_PATH/.github/copilot-instructions.md"
    echo ""
fi

# Windsurf
if [[ "$TOOLS" == "all" ]] || [[ "$TOOLS" == *"windsurf"* ]]; then
    echo "Windsurf:"
    link_file "$SCRIPT_DIR/AGENTS.md" "$PROJECT_PATH/.windsurfrules"
    echo ""
fi

# Cline
if [[ "$TOOLS" == "all" ]] || [[ "$TOOLS" == *"cline"* ]]; then
    echo "Cline:"
    link_file "$SCRIPT_DIR/AGENTS.md" "$PROJECT_PATH/.clinerules"
    echo ""
fi

echo "Done!"
echo ""
echo "Files linked from: $SCRIPT_DIR"
echo ""
echo "Tip: Add these to .gitignore if you don't want to commit symlinks:"
echo "  CLAUDE.md"
echo "  .claude/"
echo "  .cursorrules"
echo "  .cursor/"
echo "  .windsurfrules"
echo "  .clinerules"
echo "  .mcp.json"
echo "  .github/copilot-instructions.md"
