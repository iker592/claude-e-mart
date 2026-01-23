# .ai - Universal AI Config

Shared configuration for AI coding assistants that can be symlinked into any project.

## Structure

```
.ai/
├── AGENTS.md        ← Universal instructions (symlinked to all tools)
├── settings.json    ← Claude Code permissions
├── mcp.json         ← MCP servers (Claude, Cursor)
├── link-ai.sh       ← Script to link to projects
└── README.md
```

## Supported Tools

| Tool | Instructions File | MCP Config |
|------|------------------|------------|
| Claude Code | `CLAUDE.md` | `.mcp.json` |
| Cursor | `.cursorrules` | `.cursor/mcp.json` |
| GitHub Copilot | `.github/copilot-instructions.md` | - |
| Windsurf | `.windsurfrules` | - |
| Cline | `.clinerules` | - |

## Usage

### Link all tools to a project

```bash
./link-ai.sh ~/dev/my-project
```

### Link specific tools only

```bash
./link-ai.sh ~/dev/my-project claude,cursor
```

### Result

After running, your project will have:

```
my-project/
├── CLAUDE.md → .ai/AGENTS.md
├── .claude/
│   └── settings.json → .ai/settings.json
├── .mcp.json → .ai/mcp.json
├── .cursorrules → .ai/AGENTS.md
├── .cursor/
│   └── mcp.json → .ai/mcp.json
├── .windsurfrules → .ai/AGENTS.md
├── .clinerules → .ai/AGENTS.md
└── .github/
    └── copilot-instructions.md → .ai/AGENTS.md
```

## Customizing

### AGENTS.md
Edit `.ai/AGENTS.md` to change instructions for all tools. Changes apply everywhere since they're symlinks.

### settings.json
Pre-allowed commands for Claude Code:
- `git`, `gh`
- `npm`, `pnpm`, `npx`
- `uv`, `python`
- `make`, `docker`, `node`

### mcp.json
Add MCP servers that should be available in all projects. Example:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-filesystem"]
    }
  }
}
```

## .gitignore

If you don't want to commit symlinks, add to your project's `.gitignore`:

```
CLAUDE.md
.claude/
.cursorrules
.cursor/
.windsurfrules
.clinerules
.mcp.json
.github/copilot-instructions.md
```
