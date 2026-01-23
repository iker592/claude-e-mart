import { useState, useCallback } from "react";
import type { Message, ChatEvent, ToolCall } from "../types/chat";

const API_URL = "http://localhost:8000";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
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

              if (event.type === "text" && event.content) {
                assistantContent += event.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.findIndex((m) => m.id === assistantId);
                  if (lastIdx >= 0) {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: assistantContent,
                    };
                  } else {
                    updated.push({
                      id: assistantId,
                      role: "assistant",
                      content: assistantContent,
                      toolCalls: [],
                      timestamp: new Date(),
                    });
                  }
                  return updated;
                });
              } else if (event.type === "tool_use" && event.tool_id) {
                toolCalls.push({
                  id: event.tool_id,
                  name: event.tool_name || "unknown",
                  input: event.tool_input || {},
                });
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.findIndex((m) => m.id === assistantId);
                  if (lastIdx >= 0) {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      toolCalls: [...toolCalls],
                    };
                  }
                  return updated;
                });
              } else if (event.type === "tool_result" && event.tool_id) {
                const toolIdx = toolCalls.findIndex((t) => t.id === event.tool_id);
                if (toolIdx >= 0) {
                  toolCalls[toolIdx].result = event.content;
                  toolCalls[toolIdx].isError = event.is_error;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.findIndex((m) => m.id === assistantId);
                    if (lastIdx >= 0) {
                      updated[lastIdx] = {
                        ...updated[lastIdx],
                        toolCalls: [...toolCalls],
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
  }, []);

  return { messages, isLoading, sendMessage };
}
