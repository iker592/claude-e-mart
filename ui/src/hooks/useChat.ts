import { useState, useCallback, useEffect, useRef } from "react";
import type { Message, ChatEvent, ToolCall, ContentBlock } from "../types/chat";
import { useSessionStore } from "../stores/sessionStore";

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
  const { setActiveSession, updateSessionStatus } = useSessionStore();

  // Per-session message cache so switching sessions doesn't lose data
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map());
  // Track which session the UI is currently showing
  const activeSessionRef = useRef<string | null>(sessionId);
  // Track abort controllers per session (allows concurrent background streams)
  const streamsRef = useRef<Map<string, AbortController>>(new Map());

  // Keep activeSessionRef in sync
  useEffect(() => {
    activeSessionRef.current = sessionId;
  }, [sessionId]);

  // Update active session when sessionId changes
  useEffect(() => {
    setActiveSession(sessionId);
  }, [sessionId, setActiveSession]);

  // Helper: update messages for a session (cache + UI if active)
  const updateSessionMessages = useCallback(
    (targetSessionId: string, updater: (prev: Message[]) => Message[]) => {
      const cached = messagesCacheRef.current.get(targetSessionId) || [];
      const updated = updater(cached);
      messagesCacheRef.current.set(targetSessionId, updated);

      // Only update React state if this session is currently being viewed
      if (activeSessionRef.current === targetSessionId) {
        setMessages(updated);
      }
    },
    []
  );

  const sendMessage = useCallback(async (content: string) => {
    const currentSessionId = sessionId;

    // Cancel any existing stream for THIS session only
    if (currentSessionId) {
      const existing = streamsRef.current.get(currentSessionId);
      if (existing) existing.abort();
    }

    const abortController = new AbortController();
    // Store by session id (or a temp key for new sessions)
    const streamKey = currentSessionId || "__new__";
    streamsRef.current.set(streamKey, abortController);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    // Add user message via cache-aware updater
    if (currentSessionId) {
      updateSessionMessages(currentSessionId, (prev) => [...prev, userMessage]);
    } else {
      // No session yet — update UI directly, cache will be set when session_init arrives
      setMessages((prev) => [...prev, userMessage]);
    }
    setIsLoading(true);

    const assistantId = crypto.randomUUID();
    let assistantContent = "";
    const toolCalls: ToolCall[] = [];
    const contentBlocks: ContentBlock[] = [];
    let currentTextBlockIndex = -1;
    // Track the resolved session id (may be assigned by server via session_init)
    let resolvedSessionId = currentSessionId;

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          ...(currentSessionId && { session_id: currentSessionId })
        }),
        signal: abortController.signal,
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
                resolvedSessionId = event.session_id;

                // Migrate stream key from __new__ to the real session id
                if (!currentSessionId) {
                  streamsRef.current.delete("__new__");
                  streamsRef.current.set(resolvedSessionId, abortController);

                  // Move any messages we already have into the cache for this session
                  const currentMessages = messagesCacheRef.current.get("__new__") || [];
                  if (currentMessages.length > 0) {
                    messagesCacheRef.current.delete("__new__");
                    messagesCacheRef.current.set(resolvedSessionId, currentMessages);
                  } else {
                    // If we had no cache yet (messages were only in React state), seed the cache
                    messagesCacheRef.current.set(resolvedSessionId, [userMessage]);
                  }
                }

                setSessionId(resolvedSessionId);
                updateSessionStatus(resolvedSessionId, 'running');
                continue;
              }

              const targetId = resolvedSessionId || "__new__";

              // Handle both full text and text deltas (token streaming)
              if ((event.type === "text" || event.type === "text_delta") && event.content) {
                assistantContent += event.content;

                // Add or update text block
                if (currentTextBlockIndex === -1 || contentBlocks[currentTextBlockIndex]?.type !== "text") {
                  currentTextBlockIndex = contentBlocks.length;
                  contentBlocks.push({ type: "text", content: event.content });
                } else {
                  const textBlock = contentBlocks[currentTextBlockIndex];
                  if (textBlock.type === "text") {
                    textBlock.content += event.content;
                  }
                }

                updateSessionMessages(targetId, (prev) => {
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

                contentBlocks.push({ type: "tool_use", tool: newTool });
                currentTextBlockIndex = -1;

                updateSessionMessages(targetId, (prev) => {
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

                  updateSessionMessages(targetId, (prev) => {
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
                if (resolvedSessionId) {
                  updateSessionStatus(resolvedSessionId, 'error');
                }
                updateSessionMessages(targetId, (prev) => {
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
              } else if (event.type === "result") {
                if (resolvedSessionId) {
                  updateSessionStatus(resolvedSessionId, 'completed');
                }
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was aborted — save partial content to cache so it's not lost
        if (resolvedSessionId && assistantContent) {
          updateSessionMessages(resolvedSessionId, (prev) => {
            const updated = [...prev];
            const lastIdx = updated.findIndex((m) => m.id === assistantId);
            if (lastIdx >= 0) {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: assistantContent + "\n\n*(stream interrupted)*",
                contentBlocks: [...contentBlocks],
              };
            }
            return updated;
          });
        }
        return;
      }
      if (resolvedSessionId) {
        updateSessionStatus(resolvedSessionId, 'error');
      }
      const targetId = resolvedSessionId || "__new__";
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      };
      updateSessionMessages(targetId, (prev) => [...prev, errorMessage]);
    } finally {
      // Only clear loading if this session is still active
      if (activeSessionRef.current === resolvedSessionId) {
        setIsLoading(false);
      }
      // Clean up stream ref
      const key = resolvedSessionId || streamKey;
      streamsRef.current.delete(key);
    }
  }, [sessionId, updateSessionStatus, updateSessionMessages]);

  const resetSession = useCallback(() => {
    // Abort stream for current session
    if (sessionId) {
      const existing = streamsRef.current.get(sessionId);
      if (existing) existing.abort();
      streamsRef.current.delete(sessionId);
    }
    // Also abort any new-session stream
    const newStream = streamsRef.current.get("__new__");
    if (newStream) newStream.abort();
    streamsRef.current.delete("__new__");

    setMessages([]);
    setSessionId(null);
    setIsLoading(false);
  }, [sessionId]);

  const loadSession = useCallback(async (newSessionId: string) => {
    // Save current messages to cache before switching
    if (sessionId && sessionId !== newSessionId) {
      messagesCacheRef.current.set(sessionId, messages);
      // DON'T abort the stream — let it continue in the background
    }

    // Switch to new session
    setSessionId(newSessionId);

    // Check cache first — instant restore
    const cached = messagesCacheRef.current.get(newSessionId);
    if (cached && cached.length > 0) {
      setMessages(cached);
      // Check if there's an active stream for this session
      const hasActiveStream = streamsRef.current.has(newSessionId);
      setIsLoading(hasActiveStream);
      return;
    }

    // No cache — fetch from server
    setMessages([]);
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/sessions/${newSessionId}`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();

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
      messagesCacheRef.current.set(newSessionId, parsedMessages);
    } catch (error) {
      console.error("Failed to load session:", error);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, messages]);

  return { messages, isLoading, sendMessage, sessionId, resetSession, loadSession };
}
