"""
FastAPI server wrapping the Claude Agent SDK with token-level streaming.

Usage:
    uv run uvicorn server:app --reload --port 8000
"""

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from claude_agent_sdk.types import (
    AssistantMessage,
    ResultMessage,
    UserMessage,
    StreamEvent,
    SystemMessage,
    TextBlock,
    ToolUseBlock,
    ToolResultBlock,
)

# OpenTelemetry imports - optional, gracefully handle if not available
try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.trace import Status, StatusCode
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False
    logging.warning("OpenTelemetry packages not installed. Tracing disabled.")

logger = logging.getLogger(__name__)

# Global tracer - will be None if tracing is disabled
tracer = None


def setup_tracing():
    """Initialize OpenTelemetry tracing with OTLP exporter."""
    global tracer

    if not OTEL_AVAILABLE:
        return None

    try:
        # Create resource with service name
        resource = Resource.create({
            "service.name": "claude-e-mart-agent",
            "service.version": "0.1.0",
        })

        # Create tracer provider
        provider = TracerProvider(resource=resource)

        # Configure OTLP exporter pointing to Jaeger
        otlp_exporter = OTLPSpanExporter(
            endpoint="http://localhost:4317",
            insecure=True,
        )

        # Add batch span processor
        provider.add_span_processor(BatchSpanProcessor(otlp_exporter))

        # Set the global tracer provider
        trace.set_tracer_provider(provider)

        # Get tracer for this module
        tracer = trace.get_tracer(__name__)

        logger.info("OpenTelemetry tracing initialized with Jaeger exporter")
        return provider

    except Exception as e:
        logger.warning(f"Failed to initialize OpenTelemetry tracing: {e}. Tracing disabled.")
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for setup and cleanup."""
    # Setup tracing on startup
    provider = setup_tracing()

    # Instrument FastAPI if tracing is available
    if OTEL_AVAILABLE and provider:
        try:
            FastAPIInstrumentor.instrument_app(app)
            logger.info("FastAPI instrumented with OpenTelemetry")
        except Exception as e:
            logger.warning(f"Failed to instrument FastAPI: {e}")

    yield

    # Cleanup on shutdown
    if provider:
        try:
            provider.shutdown()
        except Exception:
            pass


app = FastAPI(title="Claude E-Mart Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class SessionInfo(BaseModel):
    session_id: str
    title: Optional[str] = None
    created_at: Optional[str] = None
    modified_at: Optional[str] = None
    file_path: str


def extract_session_title(file_path: Path, max_length: int = 50) -> Optional[str]:
    """Extract title from first user message in session file."""
    try:
        with open(file_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if entry.get('type') == 'user' and 'message' in entry:
                        content = entry['message'].get('content', '')
                        if isinstance(content, str) and content:
                            # Truncate and clean up
                            title = content.strip().replace('\n', ' ')
                            if len(title) > max_length:
                                title = title[:max_length] + "..."
                            return title
                except json.JSONDecodeError:
                    continue
    except Exception:
        pass
    return None


class SessionDetail(BaseModel):
    session_id: str
    messages: List[dict]
    created_at: Optional[str] = None
    modified_at: Optional[str] = None


# Path to Claude sessions directory
CLAUDE_SESSIONS_DIR = Path.home() / ".claude" / "projects"


async def generate_events(message: str, session_id: Optional[str] = None):
    """Stream agent responses with token-level streaming using include_partial_messages."""

    # Start a span for the chat request
    chat_span = None
    if OTEL_AVAILABLE and tracer:
        chat_span = tracer.start_span("chat_request")
        chat_span.set_attribute("session_id", session_id or "anonymous")
        chat_span.set_attribute("message_length", len(message))

    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Glob", "Grep", "Bash", "Write", "Edit"],
        permission_mode="acceptEdits",
        include_partial_messages=True,  # Enable token streaming
        resume=session_id if session_id else None,  # Resume if provided
    )

    current_session_id = None
    session_sent = False

    try:
        async with ClaudeSDKClient(options=options) as client:
            # Start span for SDK message processing
            sdk_span = None
            if OTEL_AVAILABLE and tracer:
                sdk_span = tracer.start_span("sdk_message_processing")

            try:
                await client.query(message)

                async for msg in client.receive_messages():
                    # Capture session_id from init message
                    if isinstance(msg, SystemMessage):
                        if hasattr(msg, 'subtype') and msg.subtype == 'init':
                            if hasattr(msg, 'data') and msg.data:
                                current_session_id = msg.data.get('session_id')
                                # Update span with actual session ID
                                if OTEL_AVAILABLE and chat_span and current_session_id:
                                    chat_span.set_attribute("actual_session_id", current_session_id)
                                # Stream back the session_id in the first SSE event
                                if current_session_id and not session_sent:
                                    yield {"data": json.dumps({
                                        "type": "session_init",
                                        "session_id": current_session_id
                                    })}
                                    session_sent = True
                        continue
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
                                tool_name = block.get("name", "unknown")

                                # Create span for tool call
                                if OTEL_AVAILABLE and tracer:
                                    tool_span = tracer.start_span(f"tool_call:{tool_name}")
                                    tool_span.set_attribute("tool.name", tool_name)
                                    tool_span.set_attribute("tool.id", block.get("id", ""))
                                    tool_span.end()

                                yield {"data": json.dumps({
                                    "type": "tool_use",
                                    "tool_id": block.get("id"),
                                    "tool_name": tool_name,
                                    "tool_input": {},
                                })}

                    # Handle complete messages (for tool results)
                    elif isinstance(msg, UserMessage):
                        for block in msg.content:
                            if isinstance(block, ToolResultBlock):
                                content = block.content
                                if isinstance(content, list):
                                    content = str(content)

                                # Record tool result in tracing
                                if OTEL_AVAILABLE and tracer:
                                    result_span = tracer.start_span("tool_result")
                                    result_span.set_attribute("tool.id", block.tool_use_id)
                                    result_span.set_attribute("tool.is_error", block.is_error or False)
                                    result_span.end()

                                yield {"data": json.dumps({
                                    "type": "tool_result",
                                    "tool_id": block.tool_use_id,
                                    "content": content[:500] if content else "",
                                    "is_error": block.is_error,
                                })}

                    elif isinstance(msg, ResultMessage):
                        # Record final result metrics
                        if OTEL_AVAILABLE and chat_span:
                            chat_span.set_attribute("result.cost_usd", msg.total_cost_usd or 0)
                            chat_span.set_attribute("result.duration_ms", msg.duration_ms or 0)
                            chat_span.set_attribute("result.num_turns", msg.num_turns or 0)

                        yield {"data": json.dumps({
                            "type": "result",
                            "result": msg.result,
                            "cost": msg.total_cost_usd,
                            "duration_ms": msg.duration_ms,
                            "num_turns": msg.num_turns,
                        })}
                        break
            finally:
                if sdk_span:
                    sdk_span.end()

    except Exception as e:
        # Record error in span
        if OTEL_AVAILABLE and chat_span:
            chat_span.set_status(Status(StatusCode.ERROR, str(e)))
            chat_span.record_exception(e)
        yield {"data": json.dumps({"type": "error", "content": str(e)})}
    finally:
        if chat_span:
            chat_span.end()


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Chat endpoint that streams agent responses via SSE."""
    return EventSourceResponse(generate_events(request.message, request.session_id))


@app.get("/health")
async def health():
    """Health check endpoint."""
    tracing_status = "enabled" if (OTEL_AVAILABLE and tracer) else "disabled"
    return {"status": "ok", "tracing": tracing_status}


@app.get("/api/sessions", response_model=List[SessionInfo])
async def list_sessions():
    """List available sessions from ~/.claude/projects/ directory."""
    sessions = []

    if not CLAUDE_SESSIONS_DIR.exists():
        return sessions

    # Search for session JSONL files recursively (Claude stores sessions as .jsonl)
    for session_file in CLAUDE_SESSIONS_DIR.rglob("*.jsonl"):
        try:
            stat = session_file.stat()
            session_id = session_file.stem

            # Extract title from first user message
            title = extract_session_title(session_file)

            sessions.append(SessionInfo(
                session_id=session_id,
                title=title or session_id[:8] + "...",
                created_at=str(stat.st_ctime),
                modified_at=str(stat.st_mtime),
                file_path=str(session_file)
            ))
        except Exception:
            # Skip files we can't read
            continue

    # Sort by modification time (most recent first)
    sessions.sort(key=lambda s: float(s.modified_at or 0), reverse=True)

    return sessions


@app.get("/api/sessions/{session_id}", response_model=SessionDetail)
async def get_session(session_id: str):
    """Get session details and messages by session_id."""
    if not CLAUDE_SESSIONS_DIR.exists():
        raise HTTPException(status_code=404, detail="Sessions directory not found")

    # Search for the session file (.jsonl format)
    session_file = None
    for file in CLAUDE_SESSIONS_DIR.rglob(f"{session_id}.jsonl"):
        session_file = file
        break

    if not session_file or not session_file.exists():
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    try:
        # Parse JSONL file (one JSON object per line)
        # Format: {"type": "user"|"assistant", "message": {"role": "...", "content": "..."}}
        messages = []
        with open(session_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entry = json.loads(line)
                        # Handle nested message format from Claude SDK
                        if entry.get('type') in ('user', 'assistant') and 'message' in entry:
                            messages.append(entry['message'])
                    except json.JSONDecodeError:
                        continue

        stat = session_file.stat()

        return SessionDetail(
            session_id=session_id,
            messages=messages,
            created_at=str(stat.st_ctime),
            modified_at=str(stat.st_mtime)
        )
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse session file")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
