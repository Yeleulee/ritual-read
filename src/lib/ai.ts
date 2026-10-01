/* Reading-assistant client. The browser never holds an AI key: every request goes to our server
   route (api/ai-chat.ts), which rotates across all configured Gemini and OpenRouter keys. When
   that route can't serve (keys not set up yet, every key busy, or no route, e.g. `vite preview`)
   the Supabase `ai-chat` function, with its own Gemini key, answers instead. */

export type AiProvider = 'gemini' | 'deepseek' | 'openrouter';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatRequest {
    /** Kept for compatibility; the server picks the provider from whichever keys have quota left */
    provider?: AiProvider;
    messages: ChatMessage[];
    /** Preferred Gemini model id */
    model?: string;
}

// gemini-2.0-flash has been retired by Google and now returns 404
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export function getDefaultModel(_provider?: AiProvider): string {
    return DEFAULT_GEMINI_MODEL;
}

const ASSISTANT_UNAVAILABLE = "The assistant couldn't answer right now. Try again.";

/* Returns null when the server route can't serve this request at all, so the caller falls back. */
async function viaServer(messages: ChatMessage[], model: string): Promise<string | null> {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    let res: Response;
    try {
        res = await fetch('/api/ai-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            body: JSON.stringify({ messages, model }),
        });
    } catch {
        return null;
    }
    const data = (await res.json().catch(() => null)) as { reply?: unknown; error?: unknown } | null;
    if (res.ok && typeof data?.reply === 'string') return data.reply;
    // Problems with the request itself would fail on the fallback too, so report them
    if ((res.status === 400 || res.status === 401) && typeof data?.error === 'string') throw new Error(data.error);
    return null;
}

async function viaSupabase(messages: ChatMessage[], model: string): Promise<string> {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.functions.invoke('ai-chat', { body: { messages, model } });
    if (error) {
        console.error('Edge function error:', error);
        throw new Error(ASSISTANT_UNAVAILABLE);
    }
    return data?.reply || 'No response generated';
}

export async function chat(req: ChatRequest): Promise<string> {
    const model = req.model && req.model.startsWith('gemini-') ? req.model : DEFAULT_GEMINI_MODEL;
    const reply = await viaServer(req.messages, model);
    return reply ?? viaSupabase(req.messages, model);
}
