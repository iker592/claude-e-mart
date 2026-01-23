"""
FastAPI server wrapping the Claude Agent SDK.

Usage:
    uv run uvicorn server:app --reload --port 8000
"""

import json
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import (
    AssistantMessage,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    ToolResultBlock,
)

app = FastAPI(title="Claude E-Mart Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


def format_content_block(block) -> dict | None:
    """Format a content block for the frontend."""
    if isinstance(block, TextBlock):
        return {"type": "text", "content": block.text}
    elif isinstance(block, ToolUseBlock):
        return {
            "type": "tool_use",
            "tool_name": block.name,
            "tool_input": block.input,
            "tool_id": block.id,
        }
    elif isinstance(block, ToolResultBlock):
        content = block.content
        if isinstance(content, list):
            content = str(content)
        return {
            "type": "tool_result",
            "tool_id": block.tool_use_id,
            "content": content,
            "is_error": block.is_error,
        }
    return None


async def generate_events(message: str):
    """Stream agent responses as SSE events."""
    try:
        async for msg in query(
            prompt=message,
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Glob", "Grep", "Bash", "Write", "Edit"],
                permission_mode="acceptEdits",
            ),
        ):
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    formatted = format_content_block(block)
                    if formatted:
                        yield {"event": "message", "data": json.dumps(formatted)}

            elif isinstance(msg, ResultMessage):
                yield {
                    "event": "result",
                    "data": json.dumps({
                        "type": "result",
                        "result": msg.result,
                        "cost": msg.total_cost_usd,
                        "duration_ms": msg.duration_ms,
                        "num_turns": msg.num_turns,
                    }),
                }

    except Exception as e:
        yield {
            "event": "error",
            "data": json.dumps({"type": "error", "content": str(e)}),
        }


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Chat endpoint that streams agent responses via SSE."""
    return EventSourceResponse(generate_events(request.message))


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}
