"""
FastAPI server wrapping the Claude Agent SDK with token-level streaming.

Supports multiple LLM providers:
- Direct Anthropic API (default)
- AWS Bedrock (set CLAUDE_CODE_USE_BEDROCK=1)
- Google Vertex AI (set CLAUDE_CODE_USE_VERTEX=1)

Usage:
    uv run uvicorn server:app --reload --port 8000
"""

import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from claude_agent_sdk.types import (
    ResultMessage,
    UserMessage,
    StreamEvent,
    SystemMessage,
    ToolResultBlock,
)
from session_storage import get_session_storage
from config import load_config, get_provider_info

# Configure logging to output INFO level to stdout
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
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


class LoggingStderr:
    """File-like object that logs writes to the Python logger."""

    def write(self, s):
        if s and s.strip():
            logger.info(f"[CLI stderr] {s.rstrip()}")
        return len(s) if s else 0

    def flush(self):
        pass

    def close(self):
        pass


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
    # Validate LLM provider configuration on startup
    try:
        load_config()  # Validates configuration, raises ValueError if invalid
        provider_info = get_provider_info()
        logger.info(f"LLM Provider configured: {provider_info}")
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        raise

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

# Configure CORS origins from environment variable
# CORS_ORIGINS can be a comma-separated list of allowed origins
# Default to localhost for development
cors_origins_str = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

# In production, also allow CloudFront distributions
if os.environ.get("ENV_NAME") in ("prod", "staging"):
    cors_origins.append("https://*.cloudfront.net")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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


class SessionDetail(BaseModel):
    session_id: str
    messages: List[dict]
    created_at: Optional[str] = None
    modified_at: Optional[str] = None


# Session storage (S3 or local filesystem based on environment)
session_storage = get_session_storage()


async def generate_events(message: str, session_id: Optional[str] = None):
    """Stream agent responses with token-level streaming using include_partial_messages."""

    # Start a span for the chat request
    chat_span = None
    if OTEL_AVAILABLE and tracer:
        chat_span = tracer.start_span("chat_request")
        chat_span.set_attribute("session_id", session_id or "anonymous")
        chat_span.set_attribute("message_length", len(message))

    stderr_logger = LoggingStderr()

    options = ClaudeAgentOptions(
        allowed_tools=[],  # No tools for now - just test basic chat
        permission_mode="acceptEdits",
        include_partial_messages=True,  # Enable token streaming
        resume=session_id if session_id else None,  # Resume if provided
        debug_stderr=stderr_logger,  # Capture CLI debug output
        model="us.anthropic.claude-opus-4-20250514-v1:0",  # Use inference profile
    )

    current_session_id = None
    session_sent = False
    collected_content = []  # Collect messages for session storage
    assistant_text = []  # Accumulate assistant response text

    try:
        logger.info(f"Starting Claude SDK client with options: {options}")
        async with ClaudeSDKClient(options=options) as client:
            # Start span for SDK message processing
            sdk_span = None
            if OTEL_AVAILABLE and tracer:
                sdk_span = tracer.start_span("sdk_message_processing")

            try:
                logger.info(f"Sending query: {message[:100]}")
                # Collect user message for session storage
                collected_content.append({
                    "type": "user",
                    "message": {"role": "user", "content": message},
                    "timestamp": datetime.utcnow().isoformat()
                })
                await client.query(message)
                logger.info("Query sent, waiting for messages...")

                msg_count = 0
                async for msg in client.receive_messages():
                    msg_count += 1
                    logger.info(f"Received message #{msg_count}: {type(msg).__name__} - {str(msg)[:200]}")
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
                                    assistant_text.append(text)  # Collect for session storage
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

                        # Collect assistant message for session storage
                        if assistant_text:
                            collected_content.append({
                                "type": "assistant",
                                "message": {"role": "assistant", "content": "".join(assistant_text)},
                                "timestamp": datetime.utcnow().isoformat()
                            })

                        # Save session to storage
                        if current_session_id and collected_content:
                            try:
                                session_content = "\n".join(
                                    json.dumps(entry) for entry in collected_content
                                )
                                if session_id:
                                    # Updating existing session
                                    await session_storage.update_session(
                                        current_session_id, session_content
                                    )
                                else:
                                    # Creating new session
                                    await session_storage.create_session(
                                        current_session_id, session_content
                                    )
                                logger.info(f"Saved session {current_session_id} to storage")
                            except Exception as save_err:
                                logger.error(f"Failed to save session: {save_err}")

                        yield {"data": json.dumps({
                            "type": "result",
                            "result": msg.result,
                            "cost": msg.total_cost_usd,
                            "duration_ms": msg.duration_ms,
                            "num_turns": msg.num_turns,
                        })}
                        break
                logger.info(f"Message loop ended after {msg_count} messages")
            finally:
                if sdk_span:
                    sdk_span.end()

    except Exception as e:
        # Record error in span
        logger.error(f"Exception in generate_events: {type(e).__name__}: {e}", exc_info=True)
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
    """Health check endpoint with provider and configuration information."""
    tracing_status = "enabled" if (OTEL_AVAILABLE and tracer) else "disabled"
    provider_info = get_provider_info()

    return {
        "status": "ok",
        "tracing": tracing_status,
        "llm_provider": provider_info,
    }


@app.get("/api/sessions", response_model=List[SessionInfo])
async def list_sessions():
    """List available sessions from storage (S3 or local filesystem)."""
    storage_sessions = await session_storage.list_sessions()

    return [
        SessionInfo(
            session_id=s.session_id,
            title=s.title,
            created_at=s.created_at,
            modified_at=s.modified_at,
            file_path=s.storage_path or "",
        )
        for s in storage_sessions
    ]


@app.get("/api/sessions/{session_id}", response_model=SessionDetail)
async def get_session(session_id: str):
    """Get session details and messages by session_id."""
    try:
        session_data = await session_storage.get_session(session_id)

        if not session_data:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

        return SessionDetail(
            session_id=session_data.session_id,
            messages=session_data.messages,
            created_at=session_data.created_at,
            modified_at=session_data.modified_at,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
