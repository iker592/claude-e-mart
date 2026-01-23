# Claude-E-Mart

> "Thank you, come again!" - A Claude Code plugin marketplace

A collection of Claude Code plugins for development workflows.

## Installation

Add this marketplace to Claude Code:

```bash
claude /plugin marketplace add iker592/claude-e-mart
```

Then browse and install plugins via the `/plugin` Discover tab.

## Plugins

### code-tools
Code review, commit automation, and formatting tools.

**Commands:**
- `/code-tools:commit-push-pr` - Commit, push, and create a PR in one command

**Skills:**
- `code-reviewer` - Reviews code for best practices and potential issues

**Hooks:**
- Auto-formats code after edits (supports JS/TS, Python, Go)

---

### deployment
Deploy, rollback, and verification tools.

**Commands:**
- `/deployment:deploy` - Deploy to staging or production
- `/deployment:rollback` - Rollback to a previous version

**Agents:**
- `deploy-verifier` - Verifies deployments are healthy

---

### monitoring
Alert handling and observability tools.

**Commands:**
- `/monitoring:check-status` - Check service health status

**Skills:**
- `alert-handler` - Analyzes alerts and helps resolve incidents

**MCP Integrations:**
- Sentry (error tracking)

---

## Structure

```
claude-e-mart/
├── .claude-plugin/
│   └── marketplace.json
├── plugins/
│   ├── code-tools/
│   ├── deployment/
│   └── monitoring/
└── README.md
```

## License

MIT
