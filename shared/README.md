# Shared Claude Settings

Shared Claude Code settings that can be symlinked into any project.

## What's Included

```
shared/
├── .claude/
│   ├── settings.json    ← Pre-allowed commands (git, npm, docker, etc.)
│   └── CLAUDE.md        ← Project guidelines for Claude
├── link-to-project.sh   ← Script to symlink settings to a project
└── README.md
```

## Usage

### Link to a project

```bash
# From this directory
./link-to-project.sh ~/dev/my-project

# Or with absolute path
/path/to/claude-e-mart/shared/link-to-project.sh ~/dev/my-project
```

This creates symlinks in your project:
```
my-project/
└── .claude/
    ├── settings.json → /path/to/claude-e-mart/shared/.claude/settings.json
    └── CLAUDE.md → /path/to/claude-e-mart/shared/.claude/CLAUDE.md
```

### Pre-allowed Commands

The shared `settings.json` pre-allows these commands:
- `git`, `gh` (GitHub CLI)
- `npm`, `pnpm`, `npx`
- `uv`, `python`
- `make`
- `docker`
- `node`

### Customizing

Edit `shared/.claude/settings.json` to add/remove allowed commands.

Edit `shared/.claude/CLAUDE.md` to change project guidelines.

Changes will apply to all linked projects automatically (since they're symlinks).
