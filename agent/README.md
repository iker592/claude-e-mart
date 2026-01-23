# Claude Agent SDK Examples

Basic examples using the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview).

## Setup

```bash
# Install Claude Code (required runtime)
curl -fsSL https://claude.ai/install.sh | bash

# Set API key
export ANTHROPIC_API_KEY=your-api-key
```

## Python

```bash
pip install claude-agent-sdk
python basic_agent.py "Find all TODO comments in this repo"
```

## TypeScript

```bash
npm install @anthropic-ai/claude-agent-sdk
npx ts-node basic_agent.ts "Find all TODO comments in this repo"
```

## Available Tools

| Tool | Description |
|------|-------------|
| `Read` | Read any file |
| `Write` | Create new files |
| `Edit` | Edit existing files |
| `Bash` | Run terminal commands |
| `Glob` | Find files by pattern |
| `Grep` | Search file contents |
| `WebSearch` | Search the web |
| `WebFetch` | Fetch web pages |
| `Task` | Spawn subagents |

## More Examples

See the [official examples repo](https://github.com/anthropics/claude-agent-sdk-demos) for:
- Email assistant
- Research agent
- Code reviewer
- And more
