import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../types/chat";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isUser
            ? "bg-blue-500 text-white rounded-br-sm"
            : "bg-gray-200 text-gray-900 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-code:text-pink-600 prose-code:before:content-none prose-code:after:content-none">
            <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
          </div>
        )}

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.toolCalls.map((tool) => (
              <div
                key={tool.id}
                className={`text-xs rounded p-2 ${
                  isUser ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <div className="font-mono font-semibold">{tool.name}</div>
                {tool.result && (
                  <div className="mt-1 opacity-80 max-h-20 overflow-auto">
                    {tool.result.slice(0, 200)}
                    {tool.result.length > 200 && "..."}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
