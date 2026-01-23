.PHONY: ui agent dev local jaeger stop

# Start the UI dev server
ui:
	@lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	cd ui && bun run dev

# Start the agent server
agent:
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	cd agent && uv run uvicorn server:app --reload --port 8000

# Start UI + Agent together
dev:
	@echo "Starting agent on :8000 and UI on :5173..."
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	@cd agent && FORCE_COLOR=1 uv run uvicorn server:app --reload --port 8000 --use-colors 2>&1 | sed -u $$'s/^/\033[36m[API]\033[0m /' &
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

# Stop all services
stop:
	docker-compose down
	@pkill -f "uvicorn server:app" || true
	@pkill -f "bun run dev" || true
