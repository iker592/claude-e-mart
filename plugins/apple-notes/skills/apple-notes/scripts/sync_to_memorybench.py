#!/usr/bin/env python3
"""
Sync Apple Notes to MemoryBench content directory.

Usage:
    python sync_to_memorybench.py [--folders <folder1,folder2>] [--output <path>] [--all]

Examples:
    # Sync specific folders
    python sync_to_memorybench.py --folders "Projects,Agents" --output ~/dev/memorybench/content

    # Sync all folders
    python sync_to_memorybench.py --all --output ~/dev/memorybench/content

    # Sync to default location
    python sync_to_memorybench.py --all
"""

import argparse
import subprocess
import sys
import re
from pathlib import Path
from typing import Optional, List


DEFAULT_OUTPUT = Path.home() / "dev" / "memorybench" / "content"


def get_all_folders() -> List[str]:
    """Get all folder names from Apple Notes."""
    script = 'tell application "Notes" to get name of every folder'
    result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error getting folders: {result.stderr}", file=sys.stderr)
        return []
    # Parse comma-separated list
    folders = [f.strip() for f in result.stdout.strip().split(',')]
    # Filter out Recently Deleted
    return [f for f in folders if f != "Recently Deleted"]


def get_notes_in_folder(folder: str) -> List[str]:
    """Get all note names in a folder."""
    escaped_folder = folder.replace('"', '\\"')
    script = f'tell application "Notes" to get name of every note in folder "{escaped_folder}"'
    result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
    if result.returncode != 0:
        return []
    if not result.stdout.strip():
        return []
    return [n.strip() for n in result.stdout.strip().split(',')]


def get_note_body(note_name: str, folder: str) -> Optional[str]:
    """Get the HTML body of a note."""
    escaped_name = note_name.replace('"', '\\"')
    escaped_folder = folder.replace('"', '\\"')
    script = f'tell application "Notes" to get body of note "{escaped_name}" in folder "{escaped_folder}"'
    result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def html_to_markdown(html: str, title: str) -> str:
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

    # Add title as H1
    return f"# {title}\n\n{md}"


def sanitize_filename(name: str) -> str:
    """Convert note name to safe filename."""
    # Replace problematic characters
    safe = re.sub(r'[<>:"/\\|?*]', '_', name)
    safe = re.sub(r'\s+', '_', safe)
    safe = re.sub(r'_+', '_', safe)
    safe = safe.strip('_')
    return safe[:100]  # Limit length


def sync_folder(folder: str, output_dir: Path) -> int:
    """Sync all notes from a folder to output directory. Returns count of synced notes."""
    notes = get_notes_in_folder(folder)
    if not notes:
        return 0

    # Create folder directory
    folder_dir = output_dir / sanitize_filename(folder)
    folder_dir.mkdir(parents=True, exist_ok=True)

    count = 0
    for note_name in notes:
        html = get_note_body(note_name, folder)
        if html is None or not html.strip():
            continue

        markdown = html_to_markdown(html, note_name)
        filename = sanitize_filename(note_name) + ".md"
        filepath = folder_dir / filename

        filepath.write_text(markdown)
        count += 1
        print(f"  ✓ {note_name}")

    return count


def main():
    parser = argparse.ArgumentParser(description='Sync Apple Notes to MemoryBench')
    parser.add_argument('--folders', '-f', help='Comma-separated list of folders to sync')
    parser.add_argument('--output', '-o', default=str(DEFAULT_OUTPUT), help='Output directory')
    parser.add_argument('--all', '-a', action='store_true', help='Sync all folders')

    args = parser.parse_args()

    output_dir = Path(args.output)

    if args.all:
        folders = get_all_folders()
    elif args.folders:
        folders = [f.strip() for f in args.folders.split(',')]
    else:
        print("Error: Specify --folders or --all", file=sys.stderr)
        sys.exit(1)

    print(f"📁 Syncing to: {output_dir}")
    print(f"📋 Folders: {', '.join(folders)}\n")

    total = 0
    for folder in folders:
        print(f"📂 {folder}:")
        count = sync_folder(folder, output_dir)
        if count == 0:
            print("  (empty)")
        total += count

    print(f"\n✅ Synced {total} notes to {output_dir}")


if __name__ == '__main__':
    main()
