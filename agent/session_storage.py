"""
Session storage abstraction layer with S3 and local filesystem backends.

Provides a unified interface for session CRUD operations, with automatic
fallback to local storage when S3 is not configured.

Usage:
    storage = get_session_storage()
    sessions = await storage.list_sessions()
    session = await storage.get_session("session-id")
"""

import json
import logging
import os
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class SessionData:
    """Data class representing a session."""

    def __init__(
        self,
        session_id: str,
        messages: list[dict[str, Any]],
        title: str | None = None,
        created_at: str | None = None,
        modified_at: str | None = None,
        raw_content: str | None = None,
    ):
        self.session_id = session_id
        self.messages = messages
        self.title = title
        self.created_at = created_at
        self.modified_at = modified_at
        self.raw_content = raw_content

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "messages": self.messages,
            "title": self.title,
            "created_at": self.created_at,
            "modified_at": self.modified_at,
        }


class SessionInfo:
    """Lightweight session metadata for listing."""

    def __init__(
        self,
        session_id: str,
        title: str | None = None,
        created_at: str | None = None,
        modified_at: str | None = None,
        storage_path: str | None = None,
    ):
        self.session_id = session_id
        self.title = title
        self.created_at = created_at
        self.modified_at = modified_at
        self.storage_path = storage_path

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "title": self.title,
            "created_at": self.created_at,
            "modified_at": self.modified_at,
            "file_path": self.storage_path or "",
        }


class SessionStorageBackend(ABC):
    """Abstract base class for session storage backends."""

    @abstractmethod
    async def create_session(self, session_id: str, content: str) -> SessionData:
        """Create a new session with the given content (JSONL format)."""
        pass

    @abstractmethod
    async def get_session(self, session_id: str) -> SessionData | None:
        """Retrieve a session by ID. Returns None if not found."""
        pass

    @abstractmethod
    async def list_sessions(self) -> list[SessionInfo]:
        """List all available sessions."""
        pass

    @abstractmethod
    async def update_session(self, session_id: str, content: str) -> SessionData:
        """Update an existing session's content."""
        pass

    @abstractmethod
    async def delete_session(self, session_id: str) -> bool:
        """Delete a session. Returns True if deleted, False if not found."""
        pass

    @staticmethod
    def extract_title_from_content(content: str, max_length: int = 50) -> str | None:
        """Extract title from first user message in session content."""
        try:
            for line in content.split("\n"):
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if entry.get("type") == "user" and "message" in entry:
                        msg_content = entry["message"].get("content", "")
                        if isinstance(msg_content, str) and msg_content:
                            title = msg_content.strip().replace("\n", " ")
                            if len(title) > max_length:
                                title = title[:max_length] + "..."
                            return title
                except json.JSONDecodeError:
                    continue
        except Exception:
            pass
        return None

    @staticmethod
    def parse_messages_from_content(content: str) -> list[dict[str, Any]]:
        """Parse messages from JSONL content."""
        messages = []
        for line in content.split("\n"):
            line = line.strip()
            if line:
                try:
                    entry = json.loads(line)
                    if entry.get("type") in ("user", "assistant") and "message" in entry:
                        messages.append(entry["message"])
                except json.JSONDecodeError:
                    continue
        return messages


class LocalSessionStorage(SessionStorageBackend):
    """Local filesystem-based session storage.

    Reads from ~/.claude/projects/ directory structure used by Claude SDK.
    """

    def __init__(self, base_dir: Path | None = None):
        self.base_dir = base_dir or Path.home() / ".claude" / "projects"
        logger.info(f"LocalSessionStorage initialized with base_dir: {self.base_dir}")

    async def create_session(self, session_id: str, content: str) -> SessionData:
        """Create a new session file."""
        session_file = self.base_dir / f"{session_id}.jsonl"
        session_file.parent.mkdir(parents=True, exist_ok=True)

        with open(session_file, "w") as f:
            f.write(content)

        stat = session_file.stat()
        messages = self.parse_messages_from_content(content)
        title = self.extract_title_from_content(content)

        return SessionData(
            session_id=session_id,
            messages=messages,
            title=title,
            created_at=str(stat.st_ctime),
            modified_at=str(stat.st_mtime),
            raw_content=content,
        )

    async def get_session(self, session_id: str) -> SessionData | None:
        """Get session by ID, searching recursively in base_dir."""
        if not self.base_dir.exists():
            return None

        session_file = None
        for file in self.base_dir.rglob(f"{session_id}.jsonl"):
            session_file = file
            break

        if not session_file or not session_file.exists():
            return None

        try:
            with open(session_file) as f:
                content = f.read()

            stat = session_file.stat()
            messages = self.parse_messages_from_content(content)
            title = self.extract_title_from_content(content)

            return SessionData(
                session_id=session_id,
                messages=messages,
                title=title,
                created_at=str(stat.st_ctime),
                modified_at=str(stat.st_mtime),
                raw_content=content,
            )
        except Exception as e:
            logger.error(f"Error reading session {session_id}: {e}")
            return None

    async def list_sessions(self) -> list[SessionInfo]:
        """List all sessions in the base directory."""
        sessions = []

        if not self.base_dir.exists():
            return sessions

        for session_file in self.base_dir.rglob("*.jsonl"):
            try:
                stat = session_file.stat()
                session_id = session_file.stem

                # Read file to extract title
                with open(session_file) as f:
                    content = f.read()
                title = self.extract_title_from_content(content)

                sessions.append(
                    SessionInfo(
                        session_id=session_id,
                        title=title or session_id[:8] + "...",
                        created_at=str(stat.st_ctime),
                        modified_at=str(stat.st_mtime),
                        storage_path=str(session_file),
                    )
                )
            except Exception as e:
                logger.warning(f"Error reading session file {session_file}: {e}")
                continue

        # Sort by modification time (most recent first)
        sessions.sort(key=lambda s: float(s.modified_at or 0), reverse=True)
        return sessions

    async def update_session(self, session_id: str, content: str) -> SessionData:
        """Update an existing session file."""
        session_file = None
        for file in self.base_dir.rglob(f"{session_id}.jsonl"):
            session_file = file
            break

        if not session_file:
            # Create new if not exists
            return await self.create_session(session_id, content)

        with open(session_file, "w") as f:
            f.write(content)

        stat = session_file.stat()
        messages = self.parse_messages_from_content(content)
        title = self.extract_title_from_content(content)

        return SessionData(
            session_id=session_id,
            messages=messages,
            title=title,
            created_at=str(stat.st_ctime),
            modified_at=str(stat.st_mtime),
            raw_content=content,
        )

    async def delete_session(self, session_id: str) -> bool:
        """Delete a session file."""
        if not self.base_dir.exists():
            return False

        for session_file in self.base_dir.rglob(f"{session_id}.jsonl"):
            try:
                session_file.unlink()
                return True
            except Exception as e:
                logger.error(f"Error deleting session {session_id}: {e}")
                return False

        return False


class S3SessionStorage(SessionStorageBackend):
    """S3-based session storage.

    Stores sessions as JSONL files in an S3 bucket with a configurable prefix.
    """

    def __init__(
        self,
        bucket_name: str,
        prefix: str = "sessions/",
        region_name: str | None = None,
    ):
        import boto3
        from botocore.config import Config

        self.bucket_name = bucket_name
        self.prefix = prefix.rstrip("/") + "/" if prefix else ""

        # Configure boto3 client with retries
        config = Config(retries={"max_attempts": 3, "mode": "adaptive"})

        self.s3_client = boto3.client(
            "s3",
            region_name=region_name,
            config=config,
        )

        logger.info(f"S3SessionStorage initialized with bucket: {bucket_name}, prefix: {self.prefix}")

    def _get_key(self, session_id: str) -> str:
        """Get the S3 object key for a session."""
        return f"{self.prefix}{session_id}.jsonl"

    async def create_session(self, session_id: str, content: str) -> SessionData:
        """Create a new session in S3."""
        key = self._get_key(session_id)
        now = datetime.utcnow().isoformat()

        # Store content with metadata
        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=key,
            Body=content.encode("utf-8"),
            ContentType="application/x-jsonlines",
            Metadata={
                "created_at": now,
            },
        )

        messages = self.parse_messages_from_content(content)
        title = self.extract_title_from_content(content)

        return SessionData(
            session_id=session_id,
            messages=messages,
            title=title,
            created_at=now,
            modified_at=now,
            raw_content=content,
        )

    async def get_session(self, session_id: str) -> SessionData | None:
        """Get session from S3 by ID."""
        from botocore.exceptions import ClientError

        key = self._get_key(session_id)

        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=key,
            )

            content = response["Body"].read().decode("utf-8")
            last_modified = response.get("LastModified")
            metadata = response.get("Metadata", {})

            messages = self.parse_messages_from_content(content)
            title = self.extract_title_from_content(content)

            return SessionData(
                session_id=session_id,
                messages=messages,
                title=title,
                created_at=metadata.get("created_at", str(last_modified) if last_modified else None),
                modified_at=str(last_modified) if last_modified else None,
                raw_content=content,
            )
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return None
            logger.error(f"Error getting session {session_id} from S3: {e}")
            raise

    async def list_sessions(self) -> list[SessionInfo]:
        """List all sessions in the S3 bucket with the configured prefix."""
        from botocore.exceptions import ClientError

        sessions = []
        continuation_token = None

        try:
            while True:
                list_kwargs = {
                    "Bucket": self.bucket_name,
                    "Prefix": self.prefix,
                }
                if continuation_token:
                    list_kwargs["ContinuationToken"] = continuation_token

                response = self.s3_client.list_objects_v2(**list_kwargs)

                for obj in response.get("Contents", []):
                    key = obj["Key"]
                    if not key.endswith(".jsonl"):
                        continue

                    # Extract session_id from key
                    filename = key[len(self.prefix) :] if key.startswith(self.prefix) else key
                    session_id = filename.rsplit(".jsonl", 1)[0]

                    # Get object to read content for title
                    try:
                        obj_response = self.s3_client.get_object(
                            Bucket=self.bucket_name,
                            Key=key,
                        )
                        content = obj_response["Body"].read().decode("utf-8")
                        title = self.extract_title_from_content(content)
                        metadata = obj_response.get("Metadata", {})
                        created_at = metadata.get("created_at")
                    except Exception as e:
                        logger.warning(f"Error reading session content for {session_id}: {e}")
                        title = None
                        created_at = None

                    sessions.append(
                        SessionInfo(
                            session_id=session_id,
                            title=title or session_id[:8] + "...",
                            created_at=created_at or str(obj.get("LastModified")),
                            modified_at=str(obj.get("LastModified")),
                            storage_path=f"s3://{self.bucket_name}/{key}",
                        )
                    )

                if not response.get("IsTruncated"):
                    break
                continuation_token = response.get("NextContinuationToken")

        except ClientError as e:
            logger.error(f"Error listing sessions from S3: {e}")
            raise

        # Sort by modification time (most recent first)
        sessions.sort(key=lambda s: s.modified_at or "", reverse=True)
        return sessions

    async def update_session(self, session_id: str, content: str) -> SessionData:
        """Update an existing session in S3 (overwrites the object)."""
        from botocore.exceptions import ClientError

        key = self._get_key(session_id)

        # Try to get existing metadata to preserve created_at
        created_at = None
        try:
            head_response = self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=key,
            )
            metadata = head_response.get("Metadata", {})
            created_at = metadata.get("created_at")
        except ClientError:
            pass  # Object doesn't exist, will use current time

        now = datetime.utcnow().isoformat()
        if not created_at:
            created_at = now

        # Update object
        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=key,
            Body=content.encode("utf-8"),
            ContentType="application/x-jsonlines",
            Metadata={
                "created_at": created_at,
            },
        )

        messages = self.parse_messages_from_content(content)
        title = self.extract_title_from_content(content)

        return SessionData(
            session_id=session_id,
            messages=messages,
            title=title,
            created_at=created_at,
            modified_at=now,
            raw_content=content,
        )

    async def delete_session(self, session_id: str) -> bool:
        """Delete a session from S3."""
        from botocore.exceptions import ClientError

        key = self._get_key(session_id)

        try:
            # Check if object exists first
            self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=key,
            )

            # Delete the object
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=key,
            )
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] in ("404", "NoSuchKey"):
                return False
            logger.error(f"Error deleting session {session_id} from S3: {e}")
            raise


# Singleton storage instance
_storage_instance: SessionStorageBackend | None = None


def get_session_storage() -> SessionStorageBackend:
    """Get the session storage backend.

    Uses S3 if SESSION_BUCKET_NAME environment variable is set,
    otherwise falls back to local filesystem storage.

    Returns:
        SessionStorageBackend: The configured storage backend.
    """
    global _storage_instance

    if _storage_instance is not None:
        return _storage_instance

    bucket_name = os.environ.get("SESSION_BUCKET_NAME")

    if bucket_name:
        try:
            # Try to import boto3 and create S3 storage
            import boto3  # noqa: F401

            prefix = os.environ.get("SESSION_BUCKET_PREFIX", "sessions/")
            region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")

            _storage_instance = S3SessionStorage(
                bucket_name=bucket_name,
                prefix=prefix,
                region_name=region,
            )
            logger.info(f"Using S3 session storage: bucket={bucket_name}, prefix={prefix}")
        except ImportError:
            logger.warning("boto3 not installed, falling back to local storage")
            _storage_instance = LocalSessionStorage()
        except Exception as e:
            logger.warning(f"Failed to initialize S3 storage: {e}. Falling back to local storage.")
            _storage_instance = LocalSessionStorage()
    else:
        logger.info("SESSION_BUCKET_NAME not set, using local session storage")
        _storage_instance = LocalSessionStorage()

    return _storage_instance


def reset_storage_instance():
    """Reset the storage singleton (useful for testing)."""
    global _storage_instance
    _storage_instance = None
