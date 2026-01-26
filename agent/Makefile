.PHONY: setup sync local test fix evals all

setup:
	curl -LsSf https://astral.sh/uv/install.sh | sh
	uv python install 3.12
	uv venv
	uv sync --all-extras

sync:
	uv sync --all-extras

local:
	uv run uvicorn server:app --reload --port 8000

test:
	uv run pytest

fix:
	uv run ruff check --fix .
	uv run ruff format .

evals:
	uv run pytest tests/evals/ -v

all: fix test
