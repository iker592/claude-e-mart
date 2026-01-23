---
name: apple-notes
description: Read, create, and manage Apple Notes on macOS via AppleScript. Use when user asks to read their notes, create a note, list notes or folders, add to a note, convert markdown to a note, export a note to markdown, sync notes to MemoryBench, or interact with the macOS Notes app in any way. Triggers include "show my notes", "read note X", "create a note", "add to my todo", "list my note folders", "convert this markdown to a note", "export note to markdown", "sync to memorybench".
---

# Apple Notes

Interact with macOS Notes app using AppleScript via `osascript`.

## List All Folders

```bash
osascript -e 'tell application "Notes" to get name of every folder'
```

## List All Notes

```bash
osascript -e 'tell application "Notes" to get name of every note'
```

## List Notes in a Specific Folder

```bash
osascript -e 'tell application "Notes" to get name of every note in folder "FolderName"'
```

## Read a Note by Name

```bash
osascript -e 'tell application "Notes" to get body of note "NoteName"'
```

Returns HTML content. Parse as needed.

## Create a New Note

Use heredoc for multi-line content:

```bash
osascript <<'EOF'
tell application "Notes"
    make new note at folder "Notes" with properties {name:"Note Title", body:"Note content here"}
end tell
EOF
```

## Create Note in Specific Folder

```bash
osascript <<'EOF'
tell application "Notes"
    make new note at folder "FolderName" with properties {name:"Note Title", body:"Content"}
end tell
EOF
```

## Append to Existing Note

AppleScript doesn't have native append. Read, concatenate, then overwrite:

```bash
osascript <<'EOF'
tell application "Notes"
    set theNote to note "NoteName"
    set currentBody to body of theNote
    set body of theNote to currentBody & "<br><br>New content appended"
end tell
EOF
```

## Delete a Note

```bash
osascript -e 'tell application "Notes" to delete note "NoteName"'
```

## Create Note from Markdown File

Use the bundled script to convert a markdown file to a properly formatted Apple Note:

```bash
uv run --with markdown scripts/md_to_note.py <markdown_file> [--folder <folder>] [--title <title>]
```

- Converts markdown to HTML (bold, italic, headings, lists, code blocks, tables)
- Extracts title from first `# Heading` if `--title` not provided

Example:
```bash
uv run --with markdown scripts/md_to_note.py ~/notes/meeting.md --folder "Work"
```

## Export Note to Markdown File

Use the bundled script to export an Apple Note to a markdown file:

```bash
uv run scripts/note_to_md.py <note_name> [--output <file.md>] [--folder <folder>]
```

- Converts Notes HTML to markdown (headings, bold, italic, lists, code)
- Prints to stdout if `--output` not provided

Example:
```bash
uv run scripts/note_to_md.py "Meeting Notes" -o ~/notes/meeting.md
```

## Sync to MemoryBench

Export Apple Notes folders to MemoryBench content directory as markdown:

```bash
uv run scripts/sync_to_memorybench.py --folders "Projects,Agents" --output ~/dev/memorybench/content
```

Or sync all folders:
```bash
uv run scripts/sync_to_memorybench.py --all
```

- Creates folder structure matching Notes folders
- Converts HTML to markdown
- Default output: `~/dev/memorybench/content`

## Notes

- Content is HTML formatted - use `<br>` for line breaks, `<ul><li>` for lists
- First use may trigger macOS permission prompt for Notes access
- Note names must be exact matches
- Folder "Notes" is the default folder
