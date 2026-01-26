---
name: claude-e-mart-testing
description: Test and run the Claude E-Mart chat application. Use when asked to start, test, or verify the Claude E-Mart app, run the UI or backend server, take screenshots of the chat interface, or interact with the agent browser testing workflow.
---

# Claude E-Mart Testing

Test the Claude E-Mart chat application with FastAPI backend and React frontend.

## Project Location

`/Users/iker/dev/claude-e-mart/`

## Starting the Application

### 1. Start the Backend (FastAPI)

```bash
cd /Users/iker/dev/claude-e-mart/agent && uv run uvicorn server:app --reload --port 8000
```

Runs at: http://localhost:8000

### 2. Start the Frontend (React + Vite)

```bash
cd /Users/iker/dev/claude-e-mart/ui && ~/.bun/bin/bun dev
```

Runs at: http://localhost:5173

## Testing with agent-browser

Use `agent-browser` CLI for automated UI testing:

```bash
# Open the UI
~/.bun/bin/agent-browser open http://localhost:5173

# Get interactive elements snapshot
~/.bun/bin/agent-browser snapshot -i

# Type a message (use ref from snapshot)
~/.bun/bin/agent-browser fill @e1 "Hello, what files are in this directory?"

# Click send button
~/.bun/bin/agent-browser click @e2

# Take screenshot
~/.bun/bin/agent-browser screenshot /tmp/screenshot.png --full
```

## Verification Checklist

1. Backend health: `curl http://localhost:8000/health`
2. UI loads with header "Claude E-Mart"
3. Message input and Send button visible
4. Sending a message triggers streaming response
5. Markdown renders correctly (tables, code blocks)
6. Tool calls display in UI
