# Claude Code Plugin Structure

> Official folder structure and organization for creating Claude Code plugins.

---

## Marketplace with Multiple Plugins

A **marketplace** is a collection of plugins that users can browse and install. Here's the full structure:

```
my-marketplace/
├── .claude-plugin/
│   └── marketplace.json          ← Defines the marketplace & lists plugins
├── plugins/
│   ├── code-tools/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── commands/
│   │   │   └── commit-push-pr.md
│   │   ├── skills/
│   │   │   └── code-reviewer/
│   │   │       └── SKILL.md
│   │   └── hooks/
│   │       └── hooks.json
│   │
│   ├── deployment/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── commands/
│   │   │   ├── deploy.md
│   │   │   └── rollback.md
│   │   ├── agents/
│   │   │   └── deploy-verifier.md
│   │   └── scripts/
│   │       └── deploy.sh
│   │
│   └── monitoring/
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── skills/
│       │   └── alert-handler/
│       │       └── SKILL.md
│       └── .mcp.json
│
└── README.md
```

### marketplace.json

**Location**: `.claude-plugin/marketplace.json`

```json
{
  "name": "my-marketplace",
  "owner": {
    "name": "Your Name",
    "email": "email@example.com"
  },
  "plugins": [
    {
      "name": "code-tools",
      "source": "./plugins/code-tools",
      "description": "Code review and commit automation",
      "version": "1.0.0"
    },
    {
      "name": "deployment",
      "source": "./plugins/deployment",
      "description": "Deploy and rollback tools",
      "version": "2.1.0"
    },
    {
      "name": "monitoring",
      "source": "./plugins/monitoring",
      "description": "Alert handling and monitoring",
      "version": "1.2.0"
    },
    {
      "name": "external-plugin",
      "source": {
        "source": "github",
        "repo": "owner/external-plugin"
      },
      "description": "A plugin from GitHub"
    }
  ]
}
```

### Adding a Marketplace

```bash
# Add your marketplace (from GitHub)
claude /plugin marketplace add owner/my-marketplace

# Or from a local path
claude /plugin marketplace add /path/to/my-marketplace
```

Users can then browse and install individual plugins from your marketplace via the `/plugin` Discover tab.

---

## Single Plugin Structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json              ← REQUIRED: Plugin manifest (ONLY this goes here!)
├── commands/                     ← Slash commands
│   ├── status.md
│   └── commit-push-pr.md
├── agents/                       ← Subagents
│   ├── code-simplifier.md
│   └── security-reviewer.md
├── skills/                       ← Model-invoked skills
│   ├── code-reviewer/
│   │   └── SKILL.md
│   └── verify-app/
│       ├── SKILL.md
│       └── scripts/
│           └── validate.py
├── hooks/
│   └── hooks.json               ← Hook configurations
├── scripts/                      ← Utility scripts for hooks
│   ├── format-code.sh
│   └── security-scan.sh
├── .mcp.json                     ← MCP server definitions
├── .lsp.json                     ← LSP server configurations
├── LICENSE
└── CHANGELOG.md
```

---

## Critical Rule: Component Location

**IMPORTANT**: Only `plugin.json` goes in `.claude-plugin/`. All other directories must be at the plugin root level.

```
CORRECT:
my-plugin/
├── .claude-plugin/
│   └── plugin.json
├── commands/     ← At root
├── agents/       ← At root
├── skills/       ← At root
└── hooks/        ← At root

WRONG:
my-plugin/
├── .claude-plugin/
│   ├── plugin.json
│   ├── commands/     ✗ WRONG
│   ├── agents/       ✗ WRONG
│   └── skills/       ✗ WRONG
```

---

## plugin.json Manifest

**Location**: `.claude-plugin/plugin.json`

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Description of what the plugin does",
  "author": {
    "name": "Your Name",
    "email": "author@example.com",
    "url": "https://github.com/author"
  },
  "homepage": "https://docs.example.com/plugin",
  "repository": "https://github.com/author/plugin",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],

  "commands": ["./custom/commands/special.md"],
  "agents": "./custom/agents/",
  "skills": "./custom/skills/",
  "hooks": "./hooks/hooks.json",
  "mcpServers": "./mcp-config.json",
  "lspServers": "./.lsp.json"
}
```

**Required fields**: `name` (kebab-case, no spaces)

**Optional**: `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`

---

## Commands

Simple markdown files for slash commands.

**Location**: `commands/hello.md`

```markdown
---
description: Greet the user with a personalized message
---

Greet the user named "$ARGUMENTS" warmly and ask how you can help them today.
```

Commands become available as `/plugin-name:command-name`

---

## Skills

Model-invoked features. Each skill is a directory with a `SKILL.md` file.

**Location**: `skills/code-reviewer/SKILL.md`

```markdown
---
description: Reviews code for best practices and potential issues
disable-model-invocation: true
---

When reviewing code, check for:
1. Code organization and structure
2. Error handling
3. Security concerns
4. Test coverage
```

Skills are namespaced: `/plugin-name:skill-name`

---

## Agents

Autonomous subagents for specific tasks.

**Location**: `agents/security-reviewer.md`

```markdown
---
description: Reviews code for security vulnerabilities
capabilities: ["security-analysis", "compliance-checking"]
---

# Security Reviewer Agent

Reviews code for:
- Security vulnerabilities
- OWASP compliance
- Data protection issues
```

---

## Hooks

Event handlers that respond to Claude Code events.

**Location**: `hooks/hooks.json`

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format-code.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/validate.sh"
          }
        ]
      }
    ]
  }
}
```

**Available hook events**:
- `PreToolUse`, `PostToolUse`, `PostToolUseFailure`
- `Stop`, `SubagentStop`
- `SessionStart`, `SessionEnd`
- `UserPromptSubmit`, `Notification`, `PreCompact`

**Hook types**:
- `command`: Execute shell commands/scripts
- `prompt`: Evaluate with LLM
- `agent`: Run agentic verifier with tools

---

## MCP Servers

Model Context Protocol for external tool integration (Slack, BigQuery, Sentry, etc.)

**Location**: `.mcp.json`

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["@anthropic/mcp-slack"],
      "env": {
        "SLACK_TOKEN": "${SLACK_TOKEN}"
      }
    },
    "database": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"]
    }
  }
}
```

**Key variable**: `${CLAUDE_PLUGIN_ROOT}` - Absolute path to plugin directory

---

## LSP Servers

Language Server Protocol for code intelligence.

**Location**: `.lsp.json`

```json
{
  "python": {
    "command": "pyright-langserver",
    "args": ["--stdio"],
    "extensionToLanguage": {
      ".py": "python"
    }
  }
}
```

---

## Plugin Sources

Plugins in a marketplace can come from different sources:

| Source Type | Example |
|-------------|---------|
| Local path | `"source": "./plugins/my-plugin"` |
| GitHub repo | `"source": { "source": "github", "repo": "owner/repo" }` |
| Git URL | `"source": { "source": "url", "url": "https://..." }` |

---

## Installation Scopes

| Scope     | Settings file                 | Use case                         |
|-----------|-------------------------------|----------------------------------|
| `user`    | `~/.claude/settings.json`     | Personal, all projects (default) |
| `project` | `.claude/settings.json`       | Team plugins via version control |
| `local`   | `.claude/settings.local.json` | Project-specific, gitignored     |
| `managed` | `managed-settings.json`       | Admin-controlled, read-only      |

---

## Development & Testing

```bash
# Test locally
claude --plugin-dir ./my-plugin

# Validate plugin
claude plugin validate .

# Load multiple plugins
claude --plugin-dir ./plugin-one --plugin-dir ./plugin-two
```

---

## Important Notes

1. **Path traversal**: Plugins cannot use `../` (they're copied to cache)
2. **Symlinks**: Create symlinks within plugin for external files
3. **Permissions**: Scripts must be executable (`chmod +x script.sh`)
4. **JSON validation**: All JSON files must have valid syntax
5. **Reserved names**: Cannot use `claude-plugins-official`, `anthropic-plugins`, etc.

---

## References

- [Plugin Reference](https://code.claude.com/docs/en/plugins-reference.md)
- [Creating Plugins](https://code.claude.com/docs/en/plugins.md)
- [Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces.md)
- [Discovering Plugins](https://code.claude.com/docs/en/discover-plugins.md)
