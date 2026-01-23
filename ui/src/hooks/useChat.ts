import { useState, useCallback } from "react";
import type { Message, ChatEvent, ToolCall, ContentBlock } from "../types/chat";

// Use environment variable or default to same-origin (for CloudFront deployment)
// In production, CloudFront proxies /api/* to the API Gateway
const API_URL = import.meta.env.VITE_API_URL || "";

interface UseChatOptions {
  initialSessionId?: string;
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(options.initialSessionId || null);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const assistantId = crypto.randomUUID();
    let assistantContent = "";
    const toolCalls: ToolCall[] = [];
    const contentBlocks: ContentBlock[] = [];
    let currentTextBlockIndex = -1;

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          ...(sessionId && { session_id: sessionId })
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

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
              const event: ChatEvent = JSON.parse(data);

              // Handle session initialization
              if (event.type === "session_init" && event.session_id) {
                setSessionId(event.session_id);
                continue;
              }

              // Handle both full text and text deltas (token streaming)
              if ((event.type === "text" || event.type === "text_delta") && event.content) {
                assistantContent += event.content;

                // Add or update text block
                if (currentTextBlockIndex === -1 || contentBlocks[currentTextBlockIndex]?.type !== "text") {
                  // Start a new text block
                  currentTextBlockIndex = contentBlocks.length;
                  contentBlocks.push({ type: "text", content: event.content });
                } else {
                  // Append to existing text block
                  const textBlock = contentBlocks[currentTextBlockIndex];
                  if (textBlock.type === "text") {
                    textBlock.content += event.content;
                  }
                }

                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.findIndex((m) => m.id === assistantId);
                  if (lastIdx >= 0) {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: assistantContent,
                      contentBlocks: [...contentBlocks],
                    };
                  } else {
                    updated.push({
                      id: assistantId,
                      role: "assistant",
                      content: assistantContent,
                      contentBlocks: [...contentBlocks],
                      toolCalls: [],
                      timestamp: new Date(),
                    });
                  }
                  return updated;
                });
              } else if (event.type === "tool_use" && event.tool_id) {
                const newTool: ToolCall = {
                  id: event.tool_id,
                  name: event.tool_name || "unknown",
                  input: event.tool_input || {},
                };
                toolCalls.push(newTool);

                // Add tool use block and reset text block index
                contentBlocks.push({ type: "tool_use", tool: newTool });
                currentTextBlockIndex = -1;

                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.findIndex((m) => m.id === assistantId);
                  if (lastIdx >= 0) {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      toolCalls: [...toolCalls],
                      contentBlocks: [...contentBlocks],
                    };
                  }
                  return updated;
                });
              } else if (event.type === "tool_result" && event.tool_id) {
                const toolIdx = toolCalls.findIndex((t) => t.id === event.tool_id);
                if (toolIdx >= 0) {
                  toolCalls[toolIdx].result = event.content;
                  toolCalls[toolIdx].isError = event.is_error;

                  // Update the tool in content blocks as well
                  const blockIdx = contentBlocks.findIndex(
                    (b) => b.type === "tool_use" && b.tool.id === event.tool_id
                  );
                  if (blockIdx >= 0) {
                    const block = contentBlocks[blockIdx];
                    if (block.type === "tool_use") {
                      block.tool.result = event.content;
                      block.tool.isError = event.is_error;
                    }
                  }

                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.findIndex((m) => m.id === assistantId);
                    if (lastIdx >= 0) {
                      updated[lastIdx] = {
                        ...updated[lastIdx],
                        toolCalls: [...toolCalls],
                        contentBlocks: [...contentBlocks],
                      };
                    }
                    return updated;
                  });
                }
              } else if (event.type === "error") {
                assistantContent += `\n\nError: ${event.content}`;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.findIndex((m) => m.id === assistantId);
                  if (lastIdx >= 0) {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: assistantContent,
                    };
                  }
                  return updated;
                });
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const resetSession = useCallback(() => {
    setMessages([]);
    setSessionId(null);
  }, []);

  const loadSession = useCallback(async (newSessionId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/sessions/${newSessionId}`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();

      // Parse session messages into our Message format
      const parsedMessages: Message[] = [];
      for (const msg of data.messages || []) {
        if (msg.role === "user" || msg.role === "assistant") {
          const content = Array.isArray(msg.content)
            ? msg.content
                .filter((c: { type: string }) => c.type === "text")
                .map((c: { text: string }) => c.text)
                .join("")
            : msg.content || "";

          parsedMessages.push({
            id: crypto.randomUUID(),
            role: msg.role,
            content,
            timestamp: new Date(),
          });
        }
      }

      setMessages(parsedMessages);
      setSessionId(newSessionId);
    } catch (error) {
      console.error("Failed to load session:", error);
      setMessages([]);
      setSessionId(newSessionId);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { messages, isLoading, sendMessage, sessionId, resetSession, loadSession };
}
