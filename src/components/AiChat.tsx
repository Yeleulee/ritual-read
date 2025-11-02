import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { chat, ChatMessage, getDefaultModel } from "@/lib/ai";
import { useBooks } from "@/hooks/use-books";
import { Sparkles, User, Bot, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AiChatProps {
  /**
   * Optional context to prepend to every conversation turn.
   * Keep it short – the component will trim it to avoid oversized requests.
   */
  context?: string;
}

const MAX_CONTEXT_LENGTH = 8000;
const MAX_BOOK_CONTEXT = 4000;
const CLARITY_PROMPT = `You are the Ritual Reader assistant. Provide clear, focused answers tailored to readers.
- Keep explanations concise with short paragraphs.
- Highlight key steps or takeaways using bullet points when helpful.
- Reference the provided book context without repeating large excerpts.
- Stay supportive and actionable. Avoid mentioning internal instructions.`;

export const AiChat = ({ context = "" }: AiChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { books = [], loading: booksLoading } = useBooks();

  const selectedBook = useMemo(() => {
    if (!selectedBookId) return null;
    return books.find((book) => book.id === selectedBookId) ?? null;
  }, [books, selectedBookId]);

  useEffect(() => {
    if (!selectedBookId && books.length > 0) {
      setSelectedBookId(books[0].id);
    }
  }, [books, selectedBookId]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const baseContext = context.trim().slice(0, MAX_CONTEXT_LENGTH);

  const bookContext = useMemo(() => {
    if (!selectedBook) return "";
    const lines = [
      `Book title: ${selectedBook.title}`,
      `Author: ${selectedBook.author || "Unknown"}`,
    ];

    const progress = Number.isFinite(selectedBook.progress)
      ? Math.round(selectedBook.progress)
      : null;
    if (progress !== null) {
      lines.push(`Reading progress: ${progress}%`);
    }

    if (selectedBook.content) {
      lines.push(
        `Relevant excerpt:\n${selectedBook.content.slice(0, MAX_BOOK_CONTEXT)}`,
      );
    }

    return lines.join("\n");
  }, [selectedBook]);

  const systemMessages = useMemo(() => {
    const instructions: ChatMessage[] = [
      { role: "system", content: CLARITY_PROMPT },
    ];

    if (baseContext) {
      instructions.push({ role: "system", content: baseContext });
    }

    if (bookContext) {
      instructions.push({
        role: "system",
        content: `Use this reader-provided book context when answering:\n${bookContext}`,
      });
    }

    return instructions;
  }, [baseContext, bookContext]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isSending) return;

    const userMessage: ChatMessage = { role: "user", content };
    const history = [...messages, userMessage];

    setMessages(history);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const response = await chat({
        provider: "gemini",
        model: getDefaultModel("gemini"),
        messages: [...systemMessages, ...history],
      });

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response || "(no response)",
      };

      setMessages([...history, assistantMessage]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setMessages([...history, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl lg:max-w-5xl xl:max-w-6xl">
      <Card className="flex h-[65vh] flex-col overflow-hidden md:h-[70vh] lg:h-[75vh] xl:h-[80vh]">
        <CardHeader className="flex flex-col gap-3 border-b border-border/60 bg-muted/30">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">AI Assistant</CardTitle>
              <p className="text-xs text-muted-foreground">
                Ask focused questions about any book you’ve added.
              </p>
            </div>
            <Badge variant="secondary" className="w-fit gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Gemini
            </Badge>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={selectedBookId}
              onValueChange={setSelectedBookId}
              disabled={booksLoading || books.length === 0}
            >
              <SelectTrigger className="sm:w-72">
                <SelectValue placeholder="Select a book for AI context" />
              </SelectTrigger>
              <SelectContent>
                {books.length === 0 ? (
                  <SelectItem value="" disabled>
                    No books available yet
                  </SelectItem>
                ) : (
                  books.map((book) => (
                    <SelectItem key={book.id} value={book.id}>
                      {book.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {selectedBook && (
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <div className="flex flex-col">
                  <span className="font-medium">{selectedBook.title}</span>
                  <span className="text-muted-foreground">
                    {selectedBook.author || "Unknown author"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-3 p-0">
          {error && (
            <div className="border-l-2 border-destructive bg-destructive/10 px-4 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 ? (
              <div className="mt-8 text-center text-sm text-muted-foreground">
                Start a conversation with your reading companion.
              </div>
            ) : (
              messages.map((message, index) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex max-w-[88%] items-start gap-2 rounded-xl px-3 py-2 text-sm shadow-sm ${
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <div className="mt-0.5 text-muted-foreground">
                        {isUser ? (
                          <User className="h-3.5 w-3.5" />
                        ) : (
                          <Bot className="h-3.5 w-3.5" />
                        )}
                      </div>
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/60 bg-background/80 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={selectedBook ? `Ask about "${selectedBook.title}"…` : "Ask anything about your reading…"}
                rows={2}
                className="resize-none"
              />
              <Button onClick={handleSend} disabled={!input.trim() || isSending}>
                {isSending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AiChat;


