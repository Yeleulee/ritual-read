import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { chat, ChatMessage } from "@/lib/ai";
import { Sparkles, Send, User, Bot, Image as ImageIcon, BookOpen, Lightbulb, FileText, Target } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface AiChatProps {
    context?: string;
}

const QUICK_ACTIONS = [
    {
        title: "Summarize Book",
        icon: BookOpen,
        emoji: "📚",
        prompt: "Can you provide a concise summary of the current book I'm reading, highlighting the main themes and key takeaways?",
    },
    {
        title: "Explain Concept",
        icon: Lightbulb,
        emoji: "💡",
        prompt: "I'm having trouble understanding a concept from this book. Can you explain it in simpler terms?",
    },
    {
        title: "Reading Tips",
        icon: FileText,
        emoji: "✨",
        prompt: "What are some effective reading strategies to improve comprehension and retention?",
    },
    {
        title: "Recommendations",
        icon: Target,
        emoji: "🎯",
        prompt: "Can you recommend similar books based on what I'm reading?",
    },
];

const CLARITY_PROMPT = `You are Ritual, a thoughtful and upbeat reading companion.
- Provide clear, structured answers in short paragraphs.
- Surface key takeaways with bullets when it improves readability.
- Offer follow-up suggestions when helpful.
- Stay warm, empowering, and conversational.`;

export const AiChat = ({ context = "" }: AiChatProps) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const { user } = useAuth();

    // Get user's first name for personalization
    const userName = user?.user_metadata?.name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || 'there';

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "smooth",
            });
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
                    content: context.trim().slice(0, 8000)
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
                    content: response || "I couldn't process that. Please try again."
                },
            ]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "Sorry, I encountered an error. Please try again."
                },
            ]);
        } finally {
            setIsSending(false);
        }
    };

    const handleQuickAction = (prompt: string) => {
        sendMessage(prompt);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const hasMessages = messages.length > 0;

    return (
        <div className="relative mx-auto w-full max-w-2xl h-[calc(100vh-8rem)] md:h-[600px] flex flex-col">
            {/* Messages Container */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scroll-smooth scrollbar-hide"
            >
                {!hasMessages ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center h-full space-y-6 px-4">
                        {/* Welcome Text */}
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-semibold">Hey {userName}! 👋</h3>
                            <p className="text-sm text-muted-foreground max-w-xs">
                                I'm Ritual, your reading companion. How can I help you today?
                            </p>
                        </div>

                        {/* Quick Actions */}
                        <div className="w-full space-y-3">
                            <p className="text-xs text-muted-foreground text-center font-medium">Try asking:</p>
                            <div className="grid grid-cols-2 gap-2 w-full">
                                {QUICK_ACTIONS.map((action) => {
                                    const Icon = action.icon;
                                    return (
                                        <button
                                            key={action.title}
                                            onClick={() => handleQuickAction(action.prompt)}
                                            className="group flex flex-col items-start gap-2 p-4 rounded-2xl border border-border bg-card hover:bg-accent transition-all duration-200 hover:scale-[1.02] active:scale-95 hover:shadow-md"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                                <Icon className="w-5 h-5 text-primary" />
                                            </div>
                                            <span className="text-xs font-medium text-left leading-tight">
                                                {action.title}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Messages */
                    <>
                        {messages.map((message, index) => {
                            const isUser = message.role === "user";
                            return (
                                <div
                                    key={index}
                                    className={cn(
                                        "flex gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500",
                                        isUser ? "flex-row-reverse" : "flex-row"
                                    )}
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    {/* Avatar */}
                                    <Avatar className="w-8 h-8 shrink-0">
                                        <AvatarFallback
                                            className={cn(
                                                "text-xs font-medium",
                                                isUser
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted border border-border"
                                            )}
                                        >
                                            {isUser ? (
                                                <User className="w-4 h-4" />
                                            ) : (
                                                <Bot className="w-4 h-4" />
                                            )}
                                        </AvatarFallback>
                                    </Avatar>

                                    {/* Message Bubble */}
                                    <div
                                        className={cn(
                                            "max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
                                            isUser
                                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                                : "bg-card border border-border rounded-tl-sm"
                                        )}
                                    >
                                        {isUser ? (
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                                {message.content}
                                            </p>
                                        ) : (
                                            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-li:my-1">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Typing Indicator */}
                        {isSending && (
                            <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-4">
                                <Avatar className="w-8 h-8 shrink-0">
                                    <AvatarFallback className="bg-muted border border-border">
                                        <Bot className="w-4 h-4" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" />
                                        <div
                                            className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                                            style={{ animationDelay: "0.15s" }}
                                        />
                                        <div
                                            className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                                            style={{ animationDelay: "0.3s" }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Floating Input Bar */}
            <div className="sticky bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-background via-background/95 to-transparent">
                <div
                    className={cn(
                        "relative rounded-3xl border transition-all duration-300 shadow-lg",
                        "bg-card/95 backdrop-blur-xl",
                        isInputFocused
                            ? "border-primary/50 ring-2 ring-primary/20 shadow-xl"
                            : "border-border shadow-md"
                    )}
                >
                    <div className="flex items-end gap-2 p-3">
                        {/* Attachment Button (Optional) */}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-10 w-10 rounded-full hover:bg-accent disabled:opacity-50"
                            disabled={isSending}
                            title="Attach image"
                        >
                            <ImageIcon className="w-5 h-5" />
                        </Button>

                        {/* Input */}
                        <Textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            placeholder="Ask me anything..."
                            rows={1}
                            disabled={isSending}
                            className="flex-1 min-h-[40px] max-h-[120px] resize-none border-none bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm placeholder:text-muted-foreground disabled:opacity-50"
                        />

                        {/* Send Button */}
                        <Button
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim() || isSending}
                            size="icon"
                            className="shrink-0 h-10 w-10 rounded-full bg-primary hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 shadow-md hover:shadow-lg active:scale-95"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Character Count */}
                    {input.length > 200 && (
                        <div className="px-4 pb-2">
                            <p className={cn(
                                "text-xs text-right transition-colors",
                                input.length > 450 ? "text-destructive" : "text-muted-foreground"
                            )}>
                                {input.length} / 500
                            </p>
                        </div>
                    )}
                </div>

                {/* Helper Text */}
                <p className="text-center text-xs text-muted-foreground mt-3">
                    Ritual AI provides thoughtful responses to enhance your reading
                </p>
            </div>
        </div>
    );
};

export default AiChat;
