import { useState, type FormEvent, type KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderTop: "1px solid var(--border-color)",
      }}
    >
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Shift+Enter for new line)"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg px-4 py-2 focus:outline-none focus:ring-2 transition-colors"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            borderColor: "var(--border-color)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-color)",
          }}
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="rounded-lg px-6 py-2 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: disabled || !input.trim() ? "var(--text-muted)" : "var(--accent)",
          }}
        >
          Send
        </button>
      </div>
    </form>
  );
}
