import { useEffect, useRef } from "react";
import type { Message } from "../types/chat";
import { ChatMessage } from "./ChatMessage";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <div className="text-center mt-8" style={{ color: "var(--text-muted)" }}>
          <p className="text-lg">Welcome to Claude E-Mart</p>
          <p className="text-sm mt-2">
            Ask me anything! I can read files, search code, and run commands.
          </p>
        </div>
      )}

      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div
            className="rounded-2xl rounded-bl-sm px-4 py-2"
            style={{ backgroundColor: "var(--bg-tertiary)" }}
          >
            <div className="flex space-x-1">
              <div
                className="w-2 h-2 rounded-full animate-bounce"
                style={{ backgroundColor: "var(--text-muted)" }}
              />
              <div
                className="w-2 h-2 rounded-full animate-bounce [animation-delay:0.1s]"
                style={{ backgroundColor: "var(--text-muted)" }}
              />
              <div
                className="w-2 h-2 rounded-full animate-bounce [animation-delay:0.2s]"
                style={{ backgroundColor: "var(--text-muted)" }}
              />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
