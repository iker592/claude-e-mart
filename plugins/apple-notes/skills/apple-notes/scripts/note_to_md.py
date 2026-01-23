#!/usr/bin/env python3
"""
Export an Apple Note to a markdown file.

Usage:
    python note_to_md.py <note_name> [--output <file.md>] [--folder <folder_name>]

If --output is not provided, prints markdown to stdout.
If --folder is not provided, searches all folders.
"""

import argparse
import subprocess
import sys
import re
from pathlib import Path
from typing import Optional


def get_note_body(note_name: str, folder: str = None) -> Optional[str]:
    """Get the HTML body of a note using AppleScript."""
    if folder:
        escaped_folder = folder.replace('"', '\\"')
        script = f'tell application "Notes" to get body of note "{note_name}" in folder "{escaped_folder}"'
    else:
        escaped_name = note_name.replace('"', '\\"')
        script = f'tell application "Notes" to get body of note "{escaped_name}"'

    try:
        result = subprocess.run(
            ['osascript', '-e', script],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print(f"Error: {result.stderr}", file=sys.stderr)
            return None
        return result.stdout.strip()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return None


def html_to_markdown(html: str) -> str:
    """Convert Apple Notes HTML to markdown."""
    md = html

    # Remove the title div (first div with just the note name)
    md = re.sub(r'^<div>[^<]+</div>\n?', '', md)

    # Headers (Apple Notes uses font-size spans)
    md = re.sub(r'<div><b><span style="font-size: 24px">([^<]+)</span></b></div>', r'## \1\n', md)
    md = re.sub(r'<div><b><span style="font-size: 18px">([^<]+)</span></b></div>', r'### \1\n', md)

    # Bold and italic
    md = re.sub(r'<b>([^<]+)</b>', r'**\1**', md)
    md = re.sub(r'<i>([^<]+)</i>', r'*\1*', md)

    # Code (monospace)
    md = re.sub(r'<font face="Courier"><tt>([^<]+)</tt></font>', r'`\1`', md)
    md = re.sub(r'<tt>([^<]+)</tt>', r'`\1`', md)

    # Lists
    md = re.sub(r'<ul>\s*', '', md)
    md = re.sub(r'</ul>\s*', '\n', md)
    md = re.sub(r'<li>([^<]*)</li>', r'- \1\n', md)

    # Line breaks and divs
    md = re.sub(r'<br\s*/?>', '\n', md)
    md = re.sub(r'<div>([^<]*)</div>', r'\1\n', md)
    md = re.sub(r'<div>', '', md)
    md = re.sub(r'</div>', '\n', md)

    # Clean up HTML entities
    md = md.replace('&quot', '"')
    md = md.replace('&amp;', '&')
    md = md.replace('&lt;', '<')
    md = md.replace('&gt;', '>')
    md = md.replace('&nbsp;', ' ')

    # Remove any remaining HTML tags
    md = re.sub(r'<[^>]+>', '', md)

    # Clean up whitespace
    md = re.sub(r'\n{3,}', '\n\n', md)
    md = md.strip()

    return md


def main():
    parser = argparse.ArgumentParser(description='Export Apple Note to markdown')
    parser.add_argument('note_name', help='Name of the note to export')
    parser.add_argument('--output', '-o', help='Output markdown file (default: stdout)')
    parser.add_argument('--folder', '-f', help='Folder containing the note')

    args = parser.parse_args()

    # Get note content
    html = get_note_body(args.note_name, args.folder)
    if html is None:
        sys.exit(1)

    # Convert to markdown
    markdown = html_to_markdown(html)

    # Add title as H1
    markdown = f"# {args.note_name}\n\n{markdown}"

    # Output
    if args.output:
        Path(args.output).write_text(markdown)
        print(f"✅ Exported '{args.note_name}' to {args.output}")
    else:
        print(markdown)


if __name__ == '__main__':
    main()
