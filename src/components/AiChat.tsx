import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { chat, ChatMessage } from "@/lib/ai";
import { Send, User, Bot, Sparkles, BookOpen, Lightbulb, FileText, Target, ArrowUp, Paperclip } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface AiChatProps {
    context?: string;
}

const QUICK_ACTIONS = [
    {
        title: "Summarize",
        icon: BookOpen,
        prompt: "Can you summarize the current section I'm reading?",
    },
    {
        title: "Explain",
        icon: Lightbulb,
        prompt: "I'm confused about this concept. Can you explain it simply?",
    },
    {
        title: "Key Takeaways",
        icon: Target,
        prompt: "What are the key takeaways from this chapter?",
    },
    {
        title: "Action Plan",
        icon: FileText,
        prompt: "How can I apply these ideas in real life?",
    },
];

const CLARITY_PROMPT = `You are Ritual, an intelligent reading assistant.
- Be concise but insightful.
- Use formatting (bold, lists) to make text skimmable.
- Focus on the content of the book/text provided.`;

export const AiChat = ({ context = "" }: AiChatProps) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const { user } = useAuth();

    const userName = user?.user_metadata?.name?.split(' ')[0] || 'Reader';

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isSending]);

    const sendMessage = async (content: string) => {
        const trimmedContent = content.trim();
        if (!trimmedContent || isSending) return;

        const userMessage: ChatMessage = { role: "user", content: trimmedContent };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsSending(true);

        try {
            const systemMessages: ChatMessage[] = [
                { role: "system", content: CLARITY_PROMPT },
            ];

            if (context.trim()) {
                systemMessages.push({
                    role: "system",
                    content: `Context from current book:\n${context.trim().slice(0, 8000)}`
                });
            }

            const response = await chat({
                provider: "openrouter",
                model: "deepseek/deepseek-r1-0528:free",
                messages: [...systemMessages, ...messages, userMessage],
            });

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: response || "I couldn't generate a response."
                },
            ]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "I encountered an error. Please try again."
                },
            ]);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] md:h-[650px] w-full max-w-4xl mx-auto relative rounded-3xl overflow-hidden bg-background/50 backdrop-blur-sm border border-border/40 shadow-2xl">

            {/* Header/Top Bar */}
            <div className="absolute top-0 left-0 right-0 z-10 px-6 py-4 bg-background/80 backdrop-blur-md border-b border-border/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold tracking-tight">Ritual AI</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Assistant</p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto pt-20 pb-32 px-4 md:px-8 space-y-6 scrollbar-hide scroll-smooth"
            >
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in fade-in zoom-in duration-500">
                        <div className="w-16 h-16 rounded-3xl bg-primary/5 flex items-center justify-center mb-6 shadow-inner ring-1 ring-border/50">
                            <Sparkles className="w-8 h-8 text-primary opacity-80" />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
                            Hello, {userName}
                        </h2>
                        <p className="text-muted-foreground max-w-md mb-8 text-base leading-relaxed">
                            I'm ready to help you analyze, summarize, or explore your reading. What's on your mind?
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                            {QUICK_ACTIONS.map((action, i) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage(action.prompt)}
                                    className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 text-left group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-background transition-colors">
                                        <action.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium block text-foreground/90">{action.title}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 max-w-3xl mx-auto">
                        {messages.map((message, index) => {
                            const isUser = message.role === "user";
                            return (
                                <div
                                    key={index}
                                    className={cn(
                                        "flex gap-4 animate-in slide-in-from-bottom-2 fade-in duration-300",
                                        isUser ? "justify-end" : "justify-start"
                                    )}
                                >
                                    {!isUser && (
                                        <Avatar className="w-8 h-8 mt-1 border border-border/50 shadow-sm shrink-0">
                                            <AvatarFallback className="bg-primary/10 text-primary text-xs">AI</AvatarFallback>
                                        </Avatar>
                                    )}

                                    <div className={cn(
                                        "relative px-5 py-3.5 max-w-[85%] sm:max-w-[75%] shadow-sm",
                                        isUser
                                            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                                            : "bg-card border border-border/60 rounded-2xl rounded-tl-sm text-foreground"
                                    )}>
                                        {isUser ? (
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                        ) : (
                                            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>

                                    {isUser && (
                                        <Avatar className="w-8 h-8 mt-1 shrink-0">
                                            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">ME</AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            );
                        })}

                        {isSending && (
                            <div className="flex gap-4 animate-pulse">
                                <Avatar className="w-8 h-8 shrink-0">
                                    <AvatarFallback className="bg-primary/10 text-primary text-xs">AI</AvatarFallback>
                                </Avatar>
                                <div className="bg-card border border-border/60 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce cursor-wait" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce delay-150 cursor-wait" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce delay-300 cursor-wait" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Floating Input Area (Aether Design) */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background via-background/90 to-transparent z-20">
                <div className="max-w-3xl mx-auto relative group">
                    <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-xl transition-opacity opacity-0 group-hover:opacity-100 duration-500 pointer-events-none" />

                    <div className="relative flex items-end gap-2 bg-card/80 backdrop-blur-xl border border-border/60 p-2 pl-4 rounded-[24px] shadow-xl focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all duration-300">
                        {/* Attachment Icon (Visual Only for now) */}
                        <button className="p-2.5 rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors shrink-0 self-end mb-0.5">
                            <Paperclip className="w-4 h-4" />
                        </button>

                        <Textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything..."
                            rows={1}
                            className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-3.5 min-h-[48px] max-h-[120px] resize-none text-sm placeholder:text-muted-foreground/70"
                        />

                        <Button
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim() || isSending}
                            size="icon"
                            className={cn(
                                "rounded-2xl w-10 h-10 shrink-0 mb-0.5 transition-all duration-300",
                                input.trim()
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                        >
                            <ArrowUp className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="text-center mt-3">
                        <p className="text-[10px] text-muted-foreground/60 font-medium tracking-wide">
                            AI can make mistakes. Check important info.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiChat;
