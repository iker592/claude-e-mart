#!/usr/bin/env python3
"""
Convert a markdown file to an Apple Note.

Usage:
    python md_to_note.py <markdown_file> [--folder <folder_name>] [--title <title>]

If --title is not provided, uses the first H1 heading or filename as the note title.
If --folder is not provided, creates note in the default "Notes" folder.

Requires: pip install markdown
"""

import argparse
import subprocess
import sys
import re
from pathlib import Path

try:
    import markdown
except ImportError:
    print("Error: 'markdown' package required. Install with: pip install markdown", file=sys.stderr)
    sys.exit(1)


def extract_title_from_md(content: str, filename: str) -> tuple[str, str]:
    """Extract title from first H1 heading, return (title, remaining_content)."""
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if line.startswith('# '):
            title = line[2:].strip()
            remaining = '\n'.join(lines[:i] + lines[i+1:]).strip()
            return title, remaining
    # No H1 found, use filename
    return Path(filename).stem, content


def md_to_html(md_content: str) -> str:
    """Convert markdown to HTML."""
    return markdown.markdown(
        md_content,
        extensions=['fenced_code', 'tables', 'nl2br']
    )


def create_note(title: str, body_html: str, folder: str = "Notes") -> bool:
    """Create an Apple Note using AppleScript."""
    # Escape backslashes and quotes for AppleScript
    escaped_body = body_html.replace('\\', '\\\\').replace('"', '\\"')
    escaped_title = title.replace('\\', '\\\\').replace('"', '\\"')
    escaped_folder = folder.replace('\\', '\\\\').replace('"', '\\"')

    applescript = f'''
tell application "Notes"
    make new note at folder "{escaped_folder}" with properties {{name:"{escaped_title}", body:"{escaped_body}"}}
end tell
'''

    try:
        result = subprocess.run(
            ['osascript', '-e', applescript],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print(f"Error: {result.stderr}", file=sys.stderr)
            return False
        print(f"✅ Created note '{title}' in folder '{folder}'")
        return True
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description='Convert markdown file to Apple Note')
    parser.add_argument('markdown_file', help='Path to the markdown file')
    parser.add_argument('--folder', '-f', default='Notes', help='Target folder in Notes app')
    parser.add_argument('--title', '-t', help='Note title (defaults to first H1 or filename)')

    args = parser.parse_args()

    # Read markdown file
    md_path = Path(args.markdown_file)
    if not md_path.exists():
        print(f"Error: File not found: {args.markdown_file}", file=sys.stderr)
        sys.exit(1)

    content = md_path.read_text()

    # Get title
    if args.title:
        title = args.title
        body_md = content
    else:
        title, body_md = extract_title_from_md(content, args.markdown_file)

    # Convert markdown to HTML
    body_html = md_to_html(body_md)

    # Create the note
    success = create_note(title, body_html, args.folder)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
