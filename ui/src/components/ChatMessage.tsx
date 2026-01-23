import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message, ContentBlock, ToolCall } from "../types/chat";

interface ChatMessageProps {
  message: Message;
}

function ToolCallBlock({ tool, isUser }: { tool: ToolCall; isUser: boolean }) {
  return (
    <div
      className="text-xs rounded p-2 my-2"
      style={{
        backgroundColor: isUser ? "rgba(255,255,255,0.2)" : "var(--bg-tertiary)",
        color: isUser ? "white" : "var(--text-secondary)",
      }}
    >
      <div className="font-mono font-semibold">{tool.name}</div>
      {tool.result && (
        <div className="mt-1 opacity-80 max-h-20 overflow-auto">
          {tool.result.slice(0, 200)}
          {tool.result.length > 200 && "..."}
        </div>
      )}
    </div>
  );
}

function renderContentBlocks(blocks: ContentBlock[], isUser: boolean) {
  return blocks.map((block, index) => {
    if (block.type === "text") {
      return (
        <div
          key={`text-${index}`}
          className="prose prose-sm max-w-none dark:prose-invert prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-code:text-pink-500 prose-code:before:content-none prose-code:after:content-none"
        >
          <Markdown remarkPlugins={[remarkGfm]}>{block.content}</Markdown>
        </div>
      );
    } else if (block.type === "tool_use") {
      return (
        <ToolCallBlock key={block.tool.id} tool={block.tool} isUser={isUser} />
      );
    }
    return null;
  });
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const hasContentBlocks = message.contentBlocks && message.contentBlocks.length > 0;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isUser ? "rounded-br-sm" : "rounded-bl-sm"
        }`}
        style={{
          backgroundColor: isUser ? "var(--accent)" : "var(--bg-tertiary)",
          color: isUser ? "white" : "var(--text-primary)",
        }}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : hasContentBlocks ? (
          renderContentBlocks(message.contentBlocks!, isUser)
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-code:text-pink-500 prose-code:before:content-none prose-code:after:content-none">
            <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
