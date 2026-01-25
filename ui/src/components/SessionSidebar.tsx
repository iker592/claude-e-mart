import { useState, useEffect } from "react";
import type { Session } from "../types/chat";

// Use environment variable or default to same-origin (for CloudFront deployment)
const API_URL = import.meta.env.VITE_API_URL || "";

interface SessionSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
}

interface APISession {
  session_id: string;
  title: string | null;
  created_at: string;
  modified_at: string;
  file_path: string;
}

export function SessionSidebar({
  isOpen,
  onClose,
  currentSessionId,
  onSelectSession,
  onNewChat,
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/sessions`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data: APISession[] = await response.json();
      setSessions(
        data.map((s) => ({
          id: s.session_id,
          title: s.title || s.session_id.slice(0, 8) + "...",
          createdAt: new Date(parseFloat(s.created_at) * 1000),
          lastMessageAt: new Date(parseFloat(s.modified_at) * 1000),
        }))
      );
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleNewChat = () => {
    onNewChat();
    onClose();
  };

  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 transition-opacity"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-72 shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderRight: "1px solid var(--border-color)",
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div
            className="flex items-center justify-between p-4"
            style={{ borderBottom: "1px solid var(--border-color)" }}
          >
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Chat History
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md transition-colors hover:opacity-70"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Close sidebar"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* New Chat Button */}
          <div className="p-3">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
              style={{
                backgroundColor: "var(--accent)",
              }}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Chat
            </button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div
                  className="animate-spin rounded-full h-6 w-6 border-b-2"
                  style={{ borderColor: "var(--accent)" }}
                ></div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                No chat history yet
              </div>
            ) : (
              <ul className="space-y-1 p-2">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <button
                      onClick={() => handleSelectSession(session.id)}
                      className="w-full text-left px-3 py-2 rounded-lg transition-colors"
                      style={{
                        backgroundColor:
                          currentSessionId === session.id
                            ? "var(--accent)"
                            : "transparent",
                        color:
                          currentSessionId === session.id
                            ? "white"
                            : "var(--text-primary)",
                      }}
                    >
                      <div className="font-medium truncate">{session.title}</div>
                      <div
                        className="text-xs"
                        style={{
                          color:
                            currentSessionId === session.id
                              ? "rgba(255,255,255,0.7)"
                              : "var(--text-muted)",
                        }}
                      >
                        {formatDate(session.lastMessageAt)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
