"""
Data models for agent state management.

Provides dataclasses and enums for tracking agent status, pending actions,
and state serialization for multi-session workspace support.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Literal


class AgentStatus(Enum):
    """Status of a background agent."""

    IDLE = "idle"
    RUNNING = "running"
    WAITING_USER = "waiting_user"  # Needs approval/answer
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class PendingAction:
    """Represents an action waiting for user response."""

    id: str
    type: Literal["approval_required", "question", "error"]
    title: str
    description: str
    options: list[str] | None = None  # e.g., ["approve", "reject"]


@dataclass
class AgentState:
    """State of a background agent for a session."""

    session_id: str
    status: AgentStatus
    pending_action: PendingAction | None = None
    progress_message: str | None = None
    last_activity: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Serialize agent state to a dictionary."""
        return {
            "session_id": self.session_id,
            "status": self.status.value,
            "pending_action": {
                "id": self.pending_action.id,
                "type": self.pending_action.type,
                "title": self.pending_action.title,
                "description": self.pending_action.description,
                "options": self.pending_action.options,
            }
            if self.pending_action
            else None,
            "progress_message": self.progress_message,
            "last_activity": self.last_activity.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AgentState":
        """Deserialize agent state from a dictionary."""
        pending = data.get("pending_action")
        return cls(
            session_id=data["session_id"],
            status=AgentStatus(data["status"]),
            pending_action=PendingAction(**pending) if pending else None,
            progress_message=data.get("progress_message"),
            last_activity=datetime.fromisoformat(data["last_activity"]),
        )
