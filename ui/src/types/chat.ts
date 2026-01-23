export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

export interface ChatEvent {
  type: "text" | "tool_use" | "tool_result" | "result" | "error";
  content?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_id?: string;
  is_error?: boolean;
  result?: string;
  cost?: number;
  duration_ms?: number;
  num_turns?: number;
}
