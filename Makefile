.PHONY: ui agent dev local jaeger stop cli

# Start the UI dev server
ui:
	@lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	cd ui && bun run dev

# Start the agent server (uses Bedrock by default)
agent:
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	cd agent && CLAUDE_CODE_USE_BEDROCK=1 AWS_PROFILE=iker-iam-user AWS_REGION=us-east-1 uv run uvicorn server:app --reload --port 8000

# Start UI + Agent together (uses Bedrock by default)
dev:
	@echo "Starting agent on :8000 and UI on :5173..."
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	@cd agent && CLAUDE_CODE_USE_BEDROCK=1 AWS_PROFILE=iker-iam-user AWS_REGION=us-east-1 FORCE_COLOR=1 uv run uvicorn server:app --reload --port 8000 --use-colors 2>&1 | sed -u $$'s/^/\033[36m[API]\033[0m /' &
	@sleep 1
	@cd ui && FORCE_COLOR=1 bun run dev 2>&1 | sed -u $$'s/^/\033[35m[UI]\033[0m  /'

# Start Jaeger for tracing
jaeger:
	docker-compose up jaeger -d

# Start everything locally (Jaeger + Agent + UI)
local: jaeger
	@echo "Starting Jaeger..."
	@sleep 2
	@make dev

# Run the CLI app (starts agent in background first)
cli:
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@echo "Starting agent on :8000 with Bedrock..."
	@cd agent && CLAUDE_CODE_USE_BEDROCK=1 AWS_PROFILE=iker-iam-user AWS_REGION=us-east-1 uv run uvicorn server:app --port 8000 > /tmp/agent.log 2>&1 &
	@sleep 2
	@cd cli && bun run src/cli.tsx

# Stop all services
stop:
	docker-compose down
	@pkill -f "uvicorn server:app" || true
	@pkill -f "bun run dev" || true
