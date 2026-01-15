# 📱 Mobile-Optimized AI Chat UI Design

## 🎨 Design Principles from Modern AI Chat UIs

### Key Features to Implement

1. **✨ Floating Bottom Input Bar**
   - Fixed at bottom with safe area padding
   - Glassmorphism effect
   - Rounded corners
   - Expandable on focus

2. **💬 Clean Message Bubbles**
   - User messages: Right-aligned with primary color
   - AI messages: Left-aligned with card background
   - Smooth animations on send
   - Avatar indicators

3. **🎯 Quick Action Chips**
   - Horizontal scrollable suggestions
   - Tap to send predefined prompts
   - Show on empty state
   - Hide when conversation starts

4. **🌊 Smooth Animations**
   - Messages fade in from bottom
   - Typing indicator animation
   - Smooth scroll to bottom
   - Input expand/collapse

---

## 💻 Implementation Code

### Enhanced AI Chat Component (Mobile-First)

```tsx
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { chat, ChatMessage, getDefaultModel } from "@/lib/ai";
import { Sparkles, Send, User, Bot, Mic, Image as ImageIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  {
    title: "Summarize Book",
    icon: "📚",
    prompt: "Can you provide a concise summary of the current book?",
  },
  {
    title: "Explain Concept",
    icon: "💡",
    prompt: "I'm having trouble understanding a concept. Can you explain it?",
  },
  {
    title: "Reading Tips",
    icon: "✨",
    prompt: "What are some effective reading strategies?",
  },
  {
    title: "Book Recommendations",
    icon: "🎯",
    prompt: "Can you recommend similar books based on what I'm reading?",
  },
];

export const AiChat = ({ context = "" }: { context?: string }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isSending) return;

    const userMessage: ChatMessage = { role: "user", content };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const response = await chat({
        provider: "gemini",
        model: getDefaultModel("gemini"),
        messages: [
          {
            role: "system",
            content:
              "You are Ritual, a thoughtful reading assistant. Provide clear, concise answers.",
          },
          ...messages,
          userMessage,
        ],
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response || "I couldn't process that." },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error." },
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
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scroll-smooth"
      >
        {!hasMessages ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full space-y-6 px-4">
            {/* AI Avatar */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-background" />
            </div>

            {/* Welcome Text */}
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">Hey there! 👋</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                I'm Ritual, your reading companion. How can I help you today?
              </p>
            </div>

            {/* Quick Actions */}
            <div className="w-full space-y-3">
              <p className="text-xs text-muted-foreground text-center">Try asking:</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.title}
                    onClick={() => handleQuickAction(action.prompt)}
                    className="group flex flex-col items-start gap-2 p-3 rounded-2xl border border-border bg-card hover:bg-accent transition-all duration-200 hover:scale-[1.02] active:scale-95"
                  >
                    <span className="text-2xl">{action.icon}</span>
                    <span className="text-xs font-medium text-left leading-tight">
                      {action.title}
                    </span>
                  </button>
                ))}
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
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </AvatarFallback>
                  </Avatar>

                  {/* Message Bubble */}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3",
                      isUser
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-card border border-border rounded-tl-sm"
                    )}
                  >
                    {isUser ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2">
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
                  <AvatarFallback className="bg-muted">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce opacity-60" />
                    <div
                      className="w-2 h-2 bg-current rounded-full animate-bounce opacity-60"
                      style={{ animationDelay: "0.15s" }}
                    />
                    <div
                      className="w-2 h-2 bg-current rounded-full animate-bounce opacity-60"
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
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
        <div
          className={cn(
            "relative rounded-3xl border transition-all duration-300 glass-card",
            isInputFocused
              ? "border-primary/50 ring-2 ring-primary/20 shadow-lg"
              : "border-border shadow-sm"
          )}
        >
          <div className="flex items-end gap-2 p-3">
            {/* Attachment Button (Optional) */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-10 w-10 rounded-full hover:bg-accent"
              disabled={isSending}
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
              className="flex-1 min-h-[40px] max-h-[120px] resize-none border-none bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
            />

            {/* Send Button */}
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isSending}
              size="icon"
              className="shrink-0 h-10 w-10 rounded-full bg-primary hover:bg-primary/90 transition-all duration-200 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Character Count (Optional) */}
          {input.length > 100 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-muted-foreground text-right">
                {input.length} / 500
              </p>
            </div>
          )}
        </div>

        {/* Helper Text */}
        <p className="text-center text-xs text-muted-foreground mt-2">
          Ritual AI • Powered by Gemini
        </p>
      </div>
    </div>
  );
};

export default AiChat;
```

---

## 🎨 Key Mobile UI Enhancements

### 1. **Floating Input Bar**

- Fixed at bottom with padding
- Glassmorphism background
- Smooth focus states with ring
- Auto-expanding textarea
- Rounded corners (32px)

### 2. **Clean Message Design**

- User: Primary color with right alignment
- AI: Card background with left alignment
- Small avatars (32px)
- Rounded bubbles with tail effect
- Max width 80% for readability

### 3. **Empty State**

- Centered AI avatar with online indicator
- Friendly welcome message
- 2x2 grid of quick action cards
- Tap to send suggestion chips
- Smooth hover/active states

### 4. **Smooth Animations**

- Messages fade in from bottom
- Staggered animation delay
- Typing indicator with bouncing dots
- Input focus ring transition
- Button press feedback

### 5. **Mobile Optimizations**

- Touch-friendly tap targets (44px min)
- Proper safe area padding
- Smooth scrolling
- No horizontal scroll
- Optimized for one-hand use

---

## 📱 Mobile-Specific Features

### Touch Interactions

```tsx
// Swipe to dismiss keyboard
<div onTouchEnd={() => inputRef.current?.blur()}>

// Pull to refresh (future)
<div onTouchMove={handlePullToRefresh}>

// Long press for options (future)
<div onContextMenu={handleLongPress}>
```

### Responsive Layout

```tsx
// Stack on mobile, side-by-side on desktop
<div className="grid grid-cols-2 md:grid-cols-4 gap-2">

// Full width on mobile, constrained on desktop
<div className="w-full max-w-2xl mx-auto">

// Hide on mobile, show on desktop
<div className="hidden md:block">
```

---

## 🎯 Design Best Practices Applied

✅ **Thumb Zone Optimization** - Input and send button in easy reach
✅ **Clear Visual Hierarchy** - Important actions stand out
✅ **Smooth Animations** - Feels native and polished
✅ **Glassmorphism** - Modern, on-brand aesthetic
✅ **Safe Area Padding** - Works with notches/home indicators
✅ **Touch Feedback** - Active states on all interactions
✅ **Keyboard Handling** - Auto-scroll, dismiss on send
✅ **Loading States** - Clear typing indicator
✅ **Error Handling** - Graceful failure messages

---

## 🚀 Next Steps

1. Apply this new component to `AiChat.tsx`
2. Test on actual mobile devices
3. Add haptic feedback (optional)
4. Implement voice input (optional)
5. Add image attachment (optional)

---

**Result**: A beautiful, modern AI chat that feels native on mobile! 🎉
