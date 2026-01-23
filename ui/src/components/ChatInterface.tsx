import { useState } from "react";
import { useChat } from "../hooks/useChat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { SessionSidebar } from "./SessionSidebar";

export function ChatInterface() {
  const { messages, isLoading, sendMessage, sessionId, resetSession, loadSession } = useChat();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleNewChat = () => {
    resetSession();
  };

  const handleSelectSession = (selectedSessionId: string) => {
    loadSession(selectedSessionId);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <SessionSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
      />

      <header className="bg-white border-b px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Open menu"
          >
            <svg
              className="w-6 h-6 text-gray-600"
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
            <h1 className="text-xl font-semibold text-gray-800">Claude E-Mart</h1>
            <p className="text-sm text-gray-500">AI-powered assistant</p>
          </div>
        </div>
      </header>

      <MessageList messages={messages} isLoading={isLoading} />

      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
