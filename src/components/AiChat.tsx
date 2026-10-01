import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chat, ChatMessage } from "@/lib/ai";
import { cn } from "@/lib/utils";

interface AiChatProps {
  context?: string;
}

const SUGGESTIONS = [
  "Summarise the section I'm reading.",
  "Explain the main idea in plain language.",
  "What should I take away from this chapter?",
  "How could I apply this?",
];

const SYSTEM_PROMPT = `You are Ritual, a reading assistant.
- Be concise and precise.
- Use short paragraphs and lists where they help.
- Stay on the book or passage provided.`;

export const AiChat = ({ context = "" }: AiChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const bookTitle = context.match(/Currently reading: "([^"]+)"/)?.[1];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const sendMessage = async (content: string) => {
    const text = content.trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const system: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
      if (context.trim()) {
        system.push({ role: "system", content: `Context from current book:\n${context.trim().slice(0, 8000)}` });
      }
      const response = await chat({
        provider: "gemini",
        messages: [...system, ...messages, userMessage],
      });
      setMessages((prev) => [...prev, { role: "assistant", content: response || "No response." }]);
    } catch (error) {
      console.error("Chat error:", error);
      const reason = error instanceof Error && error.message ? error.message : "Something went wrong. Try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: reason }]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-200px)] min-h-[520px] w-full max-w-3xl flex-col border border-border bg-card">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-serif italic text-lg leading-none">Ritual</span>
          <span className="eyebrow">Assistant</span>
        </div>
        <span className="eyebrow truncate max-w-[50%]">{bookTitle ? `Reading · ${bookTitle}` : "No book open"}</span>
      </header>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-end">
            <p className="display text-3xl sm:text-4xl max-w-md">
              Ask about what you're reading.
            </p>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              {bookTitle
                ? `Answers are grounded in “${bookTitle}”.`
                : "Open a book from the Library first and answers will be grounded in its text."}
            </p>
            <ul className="mt-8 border-t border-border">
              {SUGGESTIONS.map((s) => (
                <li key={s} className="border-b border-border">
                  <button
                    type="button"
                    onClick={() => sendMessage(s)}
                    className="group flex w-full items-center justify-between gap-4 py-3 text-left text-sm transition-colors hover:text-foreground text-foreground/80"
                  >
                    <span>{s}</span>
                    <span aria-hidden className="font-mono text-xs text-muted-foreground transition-transform group-hover:translate-x-1">→</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="space-y-8">
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <li key={i} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                  {isUser ? (
                    <div className="max-w-[80%] bg-muted px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                      {m.content}
                    </div>
                  ) : (
                    <div className="max-w-[88%] border-l-2 border-foreground pl-4">
                      <p className="eyebrow mb-2">Ritual</p>
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-serif prose-headings:font-normal prose-a:underline-offset-4 prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            {isSending && (
              <li className="border-l-2 border-border pl-4">
                <p className="eyebrow mb-2">Ritual</p>
                <p className="font-mono text-xs text-muted-foreground animate-pulse">Thinking…</p>
              </li>
            )}
          </ol>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="border-t border-border"
      >
        <div className="flex items-end gap-3 px-5 py-3 sm:px-8">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question…"
            rows={1}
            aria-label="Message"
            className="min-h-[40px] max-h-[160px] flex-1 resize-none border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button type="submit" size="sm" disabled={!input.trim() || isSending}>
            Send
          </Button>
        </div>
        <p className="border-t border-border px-5 py-2 sm:px-8 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Enter to send · Shift+Enter for a new line · Answers can be wrong
        </p>
      </form>
    </div>
  );
};

export default AiChat;
