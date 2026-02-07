"""
Agent manager for background agent task coordination.

Provides infrastructure for running multiple concurrent agent sessions,
handling user interactions (approvals, questions), and managing agent lifecycle.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any

from models import AgentState, AgentStatus, PendingAction

logger = logging.getLogger(__name__)

MAX_CONCURRENT_AGENTS = 10
AGENT_TIMEOUT_MINUTES = 30


class BackgroundAgent:
    """Represents a background agent task with response queue."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.task: asyncio.Task | None = None
        self.response_queue: asyncio.Queue = asyncio.Queue()
        self.state = AgentState(session_id=session_id, status=AgentStatus.IDLE)
        self._cancel_requested = False

    async def wait_for_user_response(self, action: PendingAction, timeout: float = 1800) -> dict | None:
        """Block until user provides response or timeout."""
        self.state.status = AgentStatus.WAITING_USER
        self.state.pending_action = action
        self.state.last_activity = datetime.utcnow()

        try:
            response = await asyncio.wait_for(self.response_queue.get(), timeout=timeout)
            self.state.status = AgentStatus.RUNNING
            self.state.pending_action = None
            self.state.last_activity = datetime.utcnow()
            return response
        except TimeoutError:
            self.state.status = AgentStatus.ERROR
            self.state.pending_action = None
            return None

    def submit_response(self, action_id: str, response: dict) -> bool:
        """Submit user response to waiting agent."""
        if self.state.pending_action and self.state.pending_action.id == action_id:
            self.response_queue.put_nowait(response)
            return True
        return False

    def cancel(self):
        """Request cancellation of the agent."""
        self._cancel_requested = True
        if self.task and not self.task.done():
            self.task.cancel()


class AgentManager:
    """Manages background agents across sessions."""

    _instance: "AgentManager | None" = None

    def __init__(self):
        self._agents: dict[str, BackgroundAgent] = {}
        self._cleanup_task: asyncio.Task | None = None

    @classmethod
    def get_instance(cls) -> "AgentManager":
        """Get the singleton instance of AgentManager."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def start(self):
        """Start the agent manager and cleanup task."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop(self):
        """Stop the agent manager and all agents."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            self._cleanup_task = None

        for agent in list(self._agents.values()):
            agent.cancel()
        self._agents.clear()

    async def _cleanup_loop(self):
        """Periodically clean up idle/timed out agents."""
        while True:
            await asyncio.sleep(60)  # Check every minute
            now = datetime.utcnow()
            timeout_threshold = now - timedelta(minutes=AGENT_TIMEOUT_MINUTES)

            for session_id, agent in list(self._agents.items()):
                if agent.state.last_activity < timeout_threshold:
                    logger.info(f"Cleaning up idle agent for session {session_id}")
                    agent.cancel()
                    del self._agents[session_id]

    def get_agent(self, session_id: str) -> BackgroundAgent | None:
        """Get an existing agent by session ID."""
        return self._agents.get(session_id)

    def get_or_create_agent(self, session_id: str) -> BackgroundAgent:
        """Get existing agent or create new one."""
        if session_id not in self._agents:
            if len(self._agents) >= MAX_CONCURRENT_AGENTS:
                raise RuntimeError(f"Maximum concurrent agents ({MAX_CONCURRENT_AGENTS}) reached")
            self._agents[session_id] = BackgroundAgent(session_id)
        return self._agents[session_id]

    async def start_agent_task(
        self,
        session_id: str,
        coroutine: Any,
    ) -> BackgroundAgent:
        """Start a background task for an agent."""
        agent = self.get_or_create_agent(session_id)
        agent.state.status = AgentStatus.RUNNING
        agent.state.last_activity = datetime.utcnow()
        agent.task = asyncio.create_task(coroutine)
        return agent

    def update_agent_state(self, session_id: str, **kwargs):
        """Update agent state fields."""
        agent = self._agents.get(session_id)
        if agent:
            for key, value in kwargs.items():
                if hasattr(agent.state, key):
                    setattr(agent.state, key, value)
            agent.state.last_activity = datetime.utcnow()

    async def cancel_agent(self, session_id: str) -> bool:
        """Cancel a running agent."""
        agent = self._agents.get(session_id)
        if agent:
            agent.cancel()
            agent.state.status = AgentStatus.COMPLETED
            return True
        return False

    def submit_user_response(self, session_id: str, action_id: str, response: dict) -> bool:
        """Submit user response to a waiting agent."""
        agent = self._agents.get(session_id)
        if agent:
            return agent.submit_response(action_id, response)
        return False

    def get_all_states(self) -> list[AgentState]:
        """Get states of all active agents."""
        return [agent.state for agent in self._agents.values()]

    def get_states_for_sessions(self, session_ids: list[str]) -> list[AgentState]:
        """Get states for specific sessions."""
        return [self._agents[sid].state for sid in session_ids if sid in self._agents]
