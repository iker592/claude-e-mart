"""
FastAPI server wrapping the Claude Agent SDK with token-level streaming.

Usage:
    uv run uvicorn server:app --reload --port 8000
"""

import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from claude_agent_sdk.types import (
    AssistantMessage,
    ResultMessage,
    UserMessage,
    StreamEvent,
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


async def generate_events(message: str):
    """Stream agent responses with token-level streaming using include_partial_messages."""
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Glob", "Grep", "Bash", "Write", "Edit"],
        permission_mode="acceptEdits",
        include_partial_messages=True,  # Enable token streaming
    )

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(message)

            async for msg in client.receive_messages():
                # Handle StreamEvent for token-level streaming
                if isinstance(msg, StreamEvent):
                    event = msg.event
                    # Handle text deltas
                    if event.get("type") == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            text = delta.get("text", "")
                            if text:
                                yield {"data": json.dumps({"type": "text_delta", "content": text})}
                        elif delta.get("type") == "input_json_delta":
                            # Tool input streaming (optional)
                            pass
                    # Handle content block start for tool use
                    elif event.get("type") == "content_block_start":
                        block = event.get("content_block", {})
                        if block.get("type") == "tool_use":
                            yield {"data": json.dumps({
                                "type": "tool_use",
                                "tool_id": block.get("id"),
                                "tool_name": block.get("name"),
                                "tool_input": {},
                            })}

                # Handle complete messages (for tool results)
                elif isinstance(msg, UserMessage):
                    for block in msg.content:
                        if isinstance(block, ToolResultBlock):
                            content = block.content
                            if isinstance(content, list):
                                content = str(content)
                            yield {"data": json.dumps({
                                "type": "tool_result",
                                "tool_id": block.tool_use_id,
                                "content": content[:500] if content else "",
                                "is_error": block.is_error,
                            })}

                elif isinstance(msg, ResultMessage):
                    yield {"data": json.dumps({
                        "type": "result",
                        "result": msg.result,
                        "cost": msg.total_cost_usd,
                        "duration_ms": msg.duration_ms,
                        "num_turns": msg.num_turns,
                    })}
                    break

    except Exception as e:
        yield {"data": json.dumps({"type": "error", "content": str(e)})}


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Chat endpoint that streams agent responses via SSE."""
    return EventSourceResponse(generate_events(request.message))


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}
