import { useChat } from "../hooks/useChat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

export function ChatInterface() {
  const { messages, isLoading, sendMessage } = useChat();

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-800">Claude E-Mart</h1>
        <p className="text-sm text-gray-500">AI-powered assistant</p>
      </header>

      <MessageList messages={messages} isLoading={isLoading} />

      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
