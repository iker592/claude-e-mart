#!/usr/bin/env bun
import React, { useState, useRef } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";
import { MarkdownText } from "./markdown.js";

const API_URL = process.env.API_URL || "http://localhost:8000";

interface ToolCall {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

interface ContentBlock {
  type: "text" | "tool_use";
  content?: string;
  tool?: ToolCall;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  contentBlocks?: ContentBlock[];
  toolCalls?: ToolCall[];
}

function Header() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        justifyContent="center"
      >
        <Text color="cyan" bold>
          Claude E-Mart CLI
        </Text>
      </Box>
      <Text dimColor>Type your message and press Enter. Ctrl+C to exit.</Text>
    </Box>
  );
}

function ToolCallDisplay({ tool }: { tool: ToolCall }) {
  return (
    <Box flexDirection="column" marginY={0} marginLeft={2}>
      <Box>
        <Text color="yellow">⚡ </Text>
        <Text color="yellow" bold>{tool.name}</Text>
        {tool.result === undefined && (
          <Text color="gray"> <Spinner type="dots" /></Text>
        )}
      </Box>
      {tool.result !== undefined && (
        <Box marginLeft={2}>
          <Text color={tool.isError ? "red" : "gray"} dimColor>
            {tool.result.slice(0, 100)}{tool.result.length > 100 ? "..." : ""}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <Box marginY={0} flexDirection="column">
        <Text color="blue" bold>You:</Text>
        <Box marginLeft={2}>
          <Text>{message.content}</Text>
        </Box>
      </Box>
    );
  }

  // Assistant message with content blocks
  return (
    <Box marginY={0} flexDirection="column">
      <Text color="green" bold>Claude:</Text>
      {message.contentBlocks?.map((block, i) => {
        if (block.type === "text" && block.content) {
          return (
            <Box key={`text-${i}`} marginLeft={2}>
              <MarkdownText>{block.content}</MarkdownText>
            </Box>
          );
        } else if (block.type === "tool_use" && block.tool) {
          return <ToolCallDisplay key={block.tool.id} tool={block.tool} />;
        }
        return null;
      })}
      {/* Fallback if no content blocks */}
      {(!message.contentBlocks || message.contentBlocks.length === 0) && message.content && (
        <Box marginLeft={2}>
          <MarkdownText>{message.content}</MarkdownText>
        </Box>
      )}
    </Box>
  );
}

function ChatInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (value: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");

  const handleSubmit = (submittedValue: string) => {
    if (submittedValue.trim() && !disabled) {
      onSubmit(submittedValue.trim());
      setValue("");
    }
  };

  return (
    <Box marginTop={1}>
      <Text color="yellow" bold>{"❯ "}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={disabled ? "Waiting..." : "Type a message..."}
      />
    </Box>
  );
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { exit } = useApp();

  const toolCallsRef = useRef<ToolCall[]>([]);
  const contentBlocksRef = useRef<ContentBlock[]>([]);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
    }
  });

  const sendMessage = async (content: string) => {
    // Add user message
    setMessages((prev) => [...prev, { role: "user", content }]);
    setIsLoading(true);
    setError(null);
    toolCallsRef.current = [];
    contentBlocksRef.current = [];

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let currentTextBlockIndex = -1;

      // Add placeholder assistant message
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", contentBlocks: [] },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            if (!data) continue;

            try {
              const event = JSON.parse(data);

              if (event.type === "session_init" && event.session_id) {
                setSessionId(event.session_id);
              } else if ((event.type === "text" || event.type === "text_delta") && event.content) {
                assistantContent += event.content;

                // Update or create text block
                if (currentTextBlockIndex === -1 || contentBlocksRef.current[currentTextBlockIndex]?.type !== "text") {
                  currentTextBlockIndex = contentBlocksRef.current.length;
                  contentBlocksRef.current.push({ type: "text", content: event.content });
                } else {
                  const block = contentBlocksRef.current[currentTextBlockIndex];
                  if (block.type === "text") {
                    block.content = (block.content || "") + event.content;
                  }
                }

                // Update message with streaming content
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                    contentBlocks: [...contentBlocksRef.current],
                    toolCalls: [...toolCallsRef.current],
                  };
                  return updated;
                });
              } else if (event.type === "tool_use" && event.tool_id) {
                const newTool: ToolCall = {
                  id: event.tool_id,
                  name: event.tool_name || "unknown",
                  input: event.tool_input,
                };
                toolCallsRef.current.push(newTool);
                contentBlocksRef.current.push({ type: "tool_use", tool: newTool });
                currentTextBlockIndex = -1;

                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                    contentBlocks: [...contentBlocksRef.current],
                    toolCalls: [...toolCallsRef.current],
                  };
                  return updated;
                });
              } else if (event.type === "tool_result" && event.tool_id) {
                const toolIdx = toolCallsRef.current.findIndex((t) => t.id === event.tool_id);
                if (toolIdx >= 0) {
                  toolCallsRef.current[toolIdx].result = event.content;
                  toolCallsRef.current[toolIdx].isError = event.is_error;

                  // Update in content blocks too
                  const blockIdx = contentBlocksRef.current.findIndex(
                    (b) => b.type === "tool_use" && b.tool?.id === event.tool_id
                  );
                  if (blockIdx >= 0) {
                    const block = contentBlocksRef.current[blockIdx];
                    if (block.type === "tool_use" && block.tool) {
                      block.tool.result = event.content;
                      block.tool.isError = event.is_error;
                    }
                  }

                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: assistantContent,
                      contentBlocks: [...contentBlocksRef.current],
                      toolCalls: [...toolCallsRef.current],
                    };
                    return updated;
                  });
                }
              } else if (event.type === "error") {
                setError(event.content || "Unknown error");
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Header />

      <Box flexDirection="column" flexGrow={1}>
        {messages.length === 0 && !isLoading && (
          <Text dimColor>Welcome! Ask me anything about your codebase.</Text>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <Box>
            <Text color="green">
              <Spinner type="dots" />
            </Text>
            <Text color="green"> Thinking...</Text>
          </Box>
        )}

        {error && (
          <Box marginY={1}>
            <Text color="red">Error: {error}</Text>
          </Box>
        )}
      </Box>

      <ChatInput onSubmit={sendMessage} disabled={isLoading} />

      {sessionId && (
        <Box marginTop={1}>
          <Text dimColor>Session: {sessionId.slice(0, 8)}...</Text>
        </Box>
      )}
    </Box>
  );
}

render(<App />);
