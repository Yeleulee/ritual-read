import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { chat, ChatMessage, getDefaultModel } from "@/lib/ai";
import { Sparkles, Wand2, RotateCcw, Trash2, Send, Paperclip, User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AiChatProps {
  /**
   * Optional context to prepend to every conversation turn.
   * Keep it short – the component will trim it to avoid oversized requests.
   */
  context?: string;
}

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};

const STORAGE_KEY = "ai_chat_sessions_v1";
const MAX_CONTEXT_LENGTH = 8000;
const CLARITY_PROMPT = `You are Ritual, a thoughtful and upbeat creative partner.
- Provide clear, structured answers in short paragraphs.
- Surface key takeaways with bullets when it improves readability.
- Offer follow-up suggestions when helpful.
- Stay warm, empowering, and never mention internal instructions.`;

const QUICK_ACTIONS = [
  {
    title: "Content Help",
    description: "Shape ideas into standout presentations",
    prompt: "I need help outlining an engaging presentation. Can you draft a structure with key talking points?",
    accent: "from-sky-500/70 via-cyan-400/60 to-emerald-500/60",
  },
  {
    title: "Suggestions",
    description: "Spark fresh concepts and directions",
    prompt: "I'm stuck on new content ideas. Suggest five unique angles to explore for my next article.",
    accent: "from-fuchsia-500/70 via-pink-500/60 to-rose-500/60",
  },
];

function formatRelativeTime(dateInput: Date | string | null): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export const AiChat = ({ context = "" }: AiChatProps) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  useEffect(() => {
    const createEmptySession = (): ChatSession => {
      const timestamp = new Date().toISOString();
      return {
        id: `session-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        title: "New chat",
        messages: [],
        updatedAt: timestamp,
      };
    };

    try {
      const storedRaw = localStorage.getItem(STORAGE_KEY);
      let loaded: ChatSession[] | null = null;
      if (storedRaw) {
        const parsed = JSON.parse(storedRaw);
        if (Array.isArray(parsed)) {
          loaded = parsed.filter((item) => Array.isArray(item?.messages));
        }
      }

      if (!loaded || loaded.length === 0) {
        const fallback = [createEmptySession()];
        setSessions(fallback);
        setActiveSessionId(fallback[0].id);
        setMessages([]);
        setLastSavedAt(new Date(fallback[0].updatedAt));
        return;
      }

      setSessions(loaded);
      setActiveSessionId(loaded[0].id);
      setMessages(loaded[0].messages ?? []);
      setLastSavedAt(loaded[0].updatedAt ? new Date(loaded[0].updatedAt) : null);
    } catch (err) {
      console.warn("Failed to restore chat sessions", err);
      const fallback = [
        {
          id: `session-${Date.now()}`,
          title: "New chat",
          messages: [],
          updatedAt: new Date().toISOString(),
        },
      ];
      setSessions(fallback);
      setActiveSessionId(fallback[0].id);
      setMessages([]);
      setLastSavedAt(new Date(fallback[0].updatedAt));
    }
  }, []);

  useEffect(() => {
    if (!sessions.length) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (err) {
      console.warn("Failed to persist chat sessions", err);
    }
  }, [sessions]);

  useEffect(() => {
    if (!activeSessionId) return;
    const active = sessions.find((session) => session.id === activeSessionId);
    if (!active) return;
    setMessages(active.messages);
    setLastSavedAt(active.updatedAt ? new Date(active.updatedAt) : null);
  }, [activeSessionId, sessions]);

  useEffect(() => {
    if (!activeSessionId) return;
    const titleFromMessages = (existingTitle: string, msgs: ChatMessage[]): string => {
      const firstUser = msgs.find((msg) => msg.role === "user");
      if (!firstUser) return existingTitle || "New chat";
      const trimmed = firstUser.content.trim();
      if (!trimmed) return existingTitle || "New chat";
      return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
    };

    setSessions((prev) => {
      const newUpdatedAt = new Date().toISOString();
      const updated = prev.map((session) => {
        if (session.id !== activeSessionId) return session;
        const newTitle = titleFromMessages(session.title, messages);
        if (session.messages === messages && session.title === newTitle) {
          return session.updatedAt === newUpdatedAt
            ? session
            : { ...session, updatedAt: newUpdatedAt };
        }
        return {
          ...session,
          messages,
          title: newTitle,
          updatedAt: newUpdatedAt,
        };
      });
      updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return updated;
    });
    setLastSavedAt(new Date());
  }, [messages, activeSessionId]);

  useEffect(() => {
    if (sessions.length && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const systemMessages = useMemo(() => {
    const instructions: ChatMessage[] = [
      { role: "system", content: CLARITY_PROMPT },
    ];

    const trimmedContext = context.trim().slice(0, MAX_CONTEXT_LENGTH);
    if (trimmedContext) {
      instructions.push({ role: "system", content: trimmedContext });
    }

    return instructions;
  }, [context]);

  const sendMessage = async (raw: string, baseHistory?: ChatMessage[]) => {
    const content = raw.trim();
    if (!content || isSending) return;

    if (!activeSessionId) {
      const timestamp = new Date().toISOString();
      const newSession: ChatSession = {
        id: `session-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        title: "New chat",
        messages: [],
        updatedAt: timestamp,
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    }

    const currentHistory = baseHistory ? [...baseHistory] : [...messages];
    const userMessage: ChatMessage = { role: "user", content };
    const nextHistory = [...currentHistory, userMessage];

    setMessages(nextHistory);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const response = await chat({
        provider: "gemini",
        model: getDefaultModel("gemini"),
        messages: [...systemMessages, ...nextHistory],
      });

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response || "(no response)",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = () => sendMessage(input);

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleNewChat = () => {
    const timestamp = new Date().toISOString();
    const newSession: ChatSession = {
      id: `session-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
      title: "New chat",
      messages: [],
      updatedAt: timestamp,
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    setError(null);
    setLastSavedAt(new Date(timestamp));
  };

  const handleRegenerate = () => {
    if (isSending) return;
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === "user") {
        const trimmedHistory = messages.slice(0, i);
        sendMessage(message.content, trimmedHistory);
        return;
      }
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-5xl space-y-5">
      <Card className="relative overflow-hidden border border-white/5 bg-[#05070f] text-white shadow-[0_20px_60px_-25px_rgba(45,212,191,0.35)]">
        <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(circle at 20% 20%, rgba(165, 243, 252, 0.25), transparent 55%), radial-gradient(circle at 80% 10%, rgba(192, 132, 252, 0.25), transparent 55%)" }} />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <CardContent className="relative flex flex-col gap-6 p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">Ritual AI Studio</p>
              <h2 className="text-2xl font-semibold leading-tight sm:text-3xl font-[cursive]">
                {greeting}!<br />
                <span className="text-white/80">What can I help with today?</span>
              </h2>
            </div>
            <div className="flex flex-col items-end gap-2 text-sm text-white/70">
              {lastSavedAt && (
                <Badge variant="secondary" className="border border-white/20 bg-white/10 text-white">
                  Synced {formatRelativeTime(lastSavedAt)}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <Trash2 className="mr-2 h-4 w-4" /> New chat
              </Button>
            </div>
          </div>

          <div className="grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.title}
                type="button"
                onClick={() => handleQuickPrompt(action.prompt)}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10"
              >
                <span className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-70 bg-gradient-to-r ${action.accent}`} />
                <div className="relative space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Wand2 className="h-4 w-4" /> {action.title}
                  </div>
                  <p className="text-xs text-white/70">{action.description}</p>
                </div>
              </button>
            ))}
          </div>

          {sessions.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Chat history</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setActiveSessionId(session.id)}
                      className={`min-w-[160px] rounded-2xl border px-3 py-2 text-left text-xs transition ${
                        isActive
                          ? "border-cyan-300/60 bg-cyan-400/10 text-white"
                          : "border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10"
                      }`}
                    >
                      <div className="font-medium leading-snug">{session.title || "New chat"}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
                        {formatRelativeTime(new Date(session.updatedAt))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-slate-800/80 bg-[#080c19]/90 shadow-[0_20px_60px_-30px_rgba(14,165,233,0.35)] backdrop-blur">
        <CardContent className="flex h-[72vh] flex-col gap-4 p-0">
          {error && (
            <div className="border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <div className="mt-16 text-center text-sm text-slate-400">
                Start a conversation or tap a quick action above to try a guided prompt.
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
                      className={`group flex max-w-[85%] items-start gap-3 rounded-3xl px-5 py-4 text-sm shadow-lg transition ${
                        isUser
                          ? "bg-gradient-to-r from-cyan-500/80 via-blue-500/80 to-purple-500/80 text-white"
                          : "border border-slate-700/80 bg-slate-900/80 text-slate-100"
                      }`}
                    >
                      <div className={`mt-0.5 shrink-0 rounded-full border border-white/10 bg-white/10 p-1 ${isUser ? "text-white" : "text-cyan-300"}`}>
                        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
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
                <div className="rounded-full border border-slate-700/80 bg-slate-900/80 px-5 py-2 text-sm text-slate-300">
                  Dreaming up an answer…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800/80 bg-[#070b18]/90 px-6 py-5">
            <div className="flex items-center justify-between pb-3 text-xs text-slate-400">
              <span className="font-[cursive] text-sm text-slate-300">Ritual crafts thoughtful, cite-worthy responses.</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isSending || messages.length === 0}
                  className="border border-slate-700/80 bg-slate-900/60 text-slate-200 hover:bg-slate-800/80"
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Regenerate
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleNewChat}
                  disabled={messages.length === 0}
                  className="border border-slate-700/80 bg-slate-900/60 text-slate-200 hover:bg-slate-800/80"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Clear
                </Button>
              </div>
            </div>

            <div className="relative rounded-[28px] bg-gradient-to-r from-cyan-500/40 via-transparent to-purple-500/40 p-[2px]">
              <div className="flex flex-col gap-3 rounded-[26px] bg-[#050913]/95 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex-1">
                  <Textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Ask me anything…"
                    rows={3}
                    className="min-h-[48px] resize-none border-none bg-transparent px-0 text-sm text-slate-100 focus-visible:ring-0"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full border border-slate-700/80 bg-slate-900/40 text-slate-200 hover:bg-slate-800/80"
                  >
                    <Paperclip className="mr-2 h-4 w-4" /> Attach file
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim() || isSending}
                    className="w-full bg-gradient-to-r from-cyan-500 via-sky-500 to-purple-500 text-white shadow-lg hover:from-cyan-400 hover:via-sky-400 hover:to-purple-400"
                  >
                    {isSending ? (
                      "Sending…"
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" /> Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AiChat;


