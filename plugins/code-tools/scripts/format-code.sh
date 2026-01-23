#!/bin/bash
# Auto-format code after edits
# Customize this script based on your project's formatters

FILE="$CLAUDE_FILE_PATH"

if [[ -z "$FILE" ]]; then
  exit 0
fi

# Format based on file extension
case "$FILE" in
  *.js|*.ts|*.jsx|*.tsx)
    if command -v prettier &> /dev/null; then
      prettier --write "$FILE" 2>/dev/null
    fi
    ;;
  *.py)
    if command -v black &> /dev/null; then
      black "$FILE" 2>/dev/null
    fi
    ;;
  *.go)
    if command -v gofmt &> /dev/null; then
      gofmt -w "$FILE" 2>/dev/null
    fi
    ;;
esac
