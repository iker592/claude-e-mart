export interface Session {
  id: string;
  title: string;
  createdAt: Date;
  lastMessageAt: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export interface TextBlock {
  type: "text";
  content: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  tool: ToolCall;
}

export type ContentBlock = TextBlock | ToolUseBlock;

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  contentBlocks?: ContentBlock[];
  toolCalls?: ToolCall[];
  timestamp: Date;
}

export interface ChatEvent {
  type: "text" | "text_delta" | "tool_use" | "tool_result" | "result" | "error" | "session_init";
  content?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_id?: string;
  is_error?: boolean;
  result?: string;
  cost?: number;
  duration_ms?: number;
  num_turns?: number;
  session_id?: string;
}
