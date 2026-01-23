#!/bin/bash
# Link shared Claude settings to a project
#
# Usage: ./link-to-project.sh /path/to/project

set -e

PROJECT_PATH="${1:-.}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_CLAUDE_DIR="$SCRIPT_DIR/.claude"

# Resolve to absolute path
PROJECT_PATH="$(cd "$PROJECT_PATH" && pwd)"

echo "Linking shared Claude settings to: $PROJECT_PATH"

# Create .claude directory if it doesn't exist
mkdir -p "$PROJECT_PATH/.claude"

# Link settings.json
if [ -f "$PROJECT_PATH/.claude/settings.json" ]; then
    echo "Warning: $PROJECT_PATH/.claude/settings.json already exists"
    read -p "Overwrite? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm "$PROJECT_PATH/.claude/settings.json"
        ln -s "$SHARED_CLAUDE_DIR/settings.json" "$PROJECT_PATH/.claude/settings.json"
        echo "✓ Linked settings.json"
    fi
else
    ln -s "$SHARED_CLAUDE_DIR/settings.json" "$PROJECT_PATH/.claude/settings.json"
    echo "✓ Linked settings.json"
fi

# Link CLAUDE.md
if [ -f "$PROJECT_PATH/.claude/CLAUDE.md" ]; then
    echo "Warning: $PROJECT_PATH/.claude/CLAUDE.md already exists (skipping)"
else
    ln -s "$SHARED_CLAUDE_DIR/CLAUDE.md" "$PROJECT_PATH/.claude/CLAUDE.md"
    echo "✓ Linked CLAUDE.md"
fi

echo ""
echo "Done! Shared settings linked to $PROJECT_PATH"
echo ""
echo "Note: Add '.claude/' to your .gitignore if you don't want to commit symlinks"
