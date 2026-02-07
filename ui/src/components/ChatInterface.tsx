import { useState, useEffect } from "react";
import { useChat } from "../hooks/useChat";
import { useTheme } from "../hooks/useTheme";
import { useNotifications } from "../hooks/useNotifications";
import { useSessionStore } from "../stores/sessionStore";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { SessionSidebar } from "./SessionSidebar";
import { PendingActionModal } from "./PendingActionModal";

// Toast notification component
function ToastNotification({
  message,
  sessionId,
  onDismiss,
  onNavigate,
}: {
  message: string;
  sessionId: string;
  onDismiss: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="fixed bottom-24 right-4 z-50 animate-slide-in-right">
      <div
        className="bg-orange-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 cursor-pointer hover:bg-orange-600 transition-colors"
        onClick={onNavigate}
      >
        <div className="flex-1">
          <div className="font-medium">Agent needs attention</div>
          <div className="text-sm text-orange-100">{message}</div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="p-1 hover:bg-orange-700 rounded"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function ChatInterface() {
  const { messages, isLoading, sendMessage, sessionId, resetSession, loadSession } = useChat();
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [knownSessionIds, setKnownSessionIds] = useState<string[]>([]);
  const [toast, setToast] = useState<{ sessionId: string; message: string } | null>(null);

  // Get session state from store
  const { sessions: sessionStates, setPendingAction } = useSessionStore();
  const activeSessionState = sessionId ? sessionStates[sessionId] : null;
  const showPendingModal = activeSessionState?.status === 'waiting_user' && activeSessionState?.pendingAction;

  // Track known session IDs
  useEffect(() => {
    if (sessionId && !knownSessionIds.includes(sessionId)) {
      setKnownSessionIds((prev) => [...prev, sessionId]);
    }
  }, [sessionId, knownSessionIds]);

  // Subscribe to notifications for all known sessions
  useNotifications({
    sessionIds: knownSessionIds,
    onNotification: (event) => {
      if (event.type === 'needs_attention' && event.session_id !== sessionId) {
        setToast({
          sessionId: event.session_id,
          message: event.pending_action?.title || 'Agent needs attention',
        });
        // Auto-dismiss after 5 seconds
        setTimeout(() => setToast(null), 5000);
      }
    },
  });

  const handleNewChat = () => {
    resetSession();
  };

  const handleSelectSession = (selectedSessionId: string) => {
    loadSession(selectedSessionId);
  };

  const handleToastNavigate = () => {
    if (toast) {
      loadSession(toast.sessionId);
      setToast(null);
    }
  };

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <SessionSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
      />

      <header
        className="border-b px-4 py-3 shadow-sm"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-md transition-colors"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Open menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                Claude E-Mart
              </h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                AI-powered assistant
              </p>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-md transition-colors"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Toggle theme"
            title={`Theme: ${theme}`}
          >
            {theme === "light" && (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
            {theme === "dark" && (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            )}
            {theme === "claude" && (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            )}
          </button>
        </div>
      </header>

      <MessageList messages={messages} isLoading={isLoading} />

      <ChatInput onSend={sendMessage} disabled={isLoading} />

      {/* Toast notification for background session alerts */}
      {toast && (
        <ToastNotification
          message={toast.message}
          sessionId={toast.sessionId}
          onDismiss={() => setToast(null)}
          onNavigate={handleToastNavigate}
        />
      )}

      {/* Pending action modal for current session */}
      {showPendingModal && activeSessionState?.pendingAction && sessionId && (
        <PendingActionModal
          sessionId={sessionId}
          action={activeSessionState.pendingAction}
          onClose={() => setPendingAction(sessionId, null)}
          onResolved={() => setPendingAction(sessionId, null)}
        />
      )}
    </div>
  );
}
