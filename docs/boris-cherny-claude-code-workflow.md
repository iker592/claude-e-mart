# Boris Cherny's Claude Code Workflow

> Boris Cherny ([@bcherny](https://x.com/bcherny)) is the creator of Claude Code at Anthropic. This document captures his viral workflow thread where he shared how he personally uses Claude Code.

---

## 1. Parallel Sessions

- Runs **5 Claude instances** in terminal tabs (numbered 1-5)
- Uses **system notifications** to know when Claude needs input
- Also runs **5-10 sessions on claude.ai/code** in parallel
- Manages sessions across terminal, web, Chrome, and iOS app
- Transfers work between local and web using `&` and `--teleport` commands

---

## 2. Model Choice

- Uses **Opus 4.5 with thinking** for everything
- Calls it "the best coding model" — slower than Sonnet but faster overall because it requires less steering and has better tool use

---

## 3. Plan Mode

- Starts **most sessions in Plan mode** (`shift+tab` twice)
- Goes back and forth refining the plan before switching to auto-accept mode
- "A good plan is really important"

---

## 4. CLAUDE.md (Team Knowledge)

- Single shared `CLAUDE.md` checked into git
- Whole team contributes multiple times a week
- During code reviews: tags `@.claude` on PRs to add learnings
- Uses Claude Code GitHub Action for integration

---

## 5. Slash Commands

- Creates custom slash commands in `.claude/commands/`
- Example: `/commit-push-pr` — uses it dozens of times daily
- Commands can include inline bash for pre-computation

---

## 6. Subagents

- Uses multiple subagents like `code-simplifier`, `verify-app`, etc.

---

## 7. Hooks

- **PostToolUse hook** for automatic code formatting
- **Stop hooks** for deterministic validation on long-running tasks

---

## 8. Permissions

- Pre-allows safe bash commands via `/permissions` rather than skipping validation
- Stores settings in `.claude/settings.json` for team sharing

---

## 9. Tool Integration (MCP)

- Claude accesses external tools: **Slack, BigQuery, Sentry** via MCP
- MCP config shared in `.mcp.json` with team

---

## 10. Long-Running Tasks

- Uses **background agents** for verification
- Uses the **ralph-wiggum plugin** (by @GeoffreyHuntley)
- Uses `--permission-mode=dontAsk` in sandboxes to prevent interruptions

---

## 11. Verification (Most Critical)

> "Verification creates **2-3x the quality** of the final result"

- Tests all changes using **Claude Chrome extension** — opens browser, tests UI, iterates until working
- Verification varies by domain: bash commands, test suites, or simulator testing
- Recommends investing heavily in robust verification systems

---

## Stats

In the last 30 days, Boris landed:
- **259 PRs**
- **497 commits**
- **40k lines added, 38k removed**
- **100% written by Claude Code + Opus 4.5**

---

## Source

- [Boris's full thread on X](https://x.com/bcherny/status/2007179832300581177)
