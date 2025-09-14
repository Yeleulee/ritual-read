import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chat, ChatMessage, AiProvider, getDefaultModel } from "@/lib/ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const LS = {
  provider: 'ai_provider',
  apiKey: 'ai_api_key',
  model: 'ai_model',
  history: 'ai_history'
};

interface AiChatProps {
  context?: string;
  compact?: boolean;
}

export const AiChat = ({ context = "", compact = false }: AiChatProps) => {
  const [provider, setProvider] = useState<AiProvider>(() => (localStorage.getItem(LS.provider) as AiProvider) || 'gemini');
  const [model, setModel] = useState<string>(() => localStorage.getItem(LS.model) || '');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS.history) || '[]'); } catch { return []; }
  });
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { localStorage.setItem(LS.provider, provider); }, [provider]);
  useEffect(() => { localStorage.setItem(LS.model, model); }, [model]);
  useEffect(() => { localStorage.setItem(LS.history, JSON.stringify(messages)); }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  // No extra chrome: keep the UI minimal

  const placeholder = useMemo(() => (
    provider === 'gemini' ? 'Ask Gemini…' : 'Ask DeepSeek…'
  ), [provider]);

  const sendWithContent = async (content: string) => {
    const payload = content.trim();
    if (!payload) return;
    const user: ChatMessage = { role: 'user', content: payload };
    setMessages(prev => [...prev, user]);
    setInput('');
    setSending(true);
    try {
      const ctx = context || "";
      const systemPrefix: ChatMessage[] = ctx ? [{ role: 'system', content: `Book context:\n${ctx.slice(0, 8000)}` }] : [];
      const reply = await chat({ provider, messages: [...systemPrefix, ...messages, user], model: model || getDefaultModel(provider) });
      setMessages(prev => [...prev, { role: 'assistant', content: reply || '(no response)' }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e?.message || e}` }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    }
  };

  const send = async () => {
    const content = input.trim();
    if (!content) return;
    await sendWithContent(content);
  };

  const clearChat = () => setMessages([]);
  const regenerate = async () => {
    if (sending) return;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        await sendWithContent(messages[i].content);
        return;
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Controls removed per request */}

      <Card className="h-[60vh] md:h-[520px]">
        <CardContent className="p-0 h-full flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3 bg-background">
            {messages.length === 0 && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-white ring-1 ring-primary/30 flex items-center justify-center">
                  <img src="/ai logo.png" alt="AI logo" className="w-full h-full object-contain p-0.5" />
                </div>
                <div>Start a conversation with your AI assistant.</div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'} shadow-sm`}>
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2 text-sm shadow-sm">
                  <span className="inline-block animate-pulse">…</span>
                </div>
              </div>
            )}
          </div>
          <div className="p-3 border-t">
            <div className="flex gap-2 items-end">
              <Textarea 
                value={input}
                onChange={e => setInput(e.target.value)} 
                placeholder={placeholder}
                rows={2}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                }}
              />
              <Button onClick={send} disabled={!input.trim() || sending} className="shrink-0">{sending ? 'Sending…' : 'Send'}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AiChat;


