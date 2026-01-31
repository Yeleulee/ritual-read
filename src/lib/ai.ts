export type AiProvider = 'gemini' | 'deepseek' | 'openrouter';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatRequest {
    provider: AiProvider;
    messages: ChatMessage[];
    model?: string;
}

function getEnvKey(provider: AiProvider): string | null {
    // Primary: Vite env
    const env = (import.meta as any).env || {};

    switch (provider) {
        case 'gemini':
            // Check env, then window global, then localStorage
            if (env.VITE_GEMINI_API_KEY) return env.VITE_GEMINI_API_KEY as string;
            try {
                const w = window as any;
                if (w.__RITUAL_KEYS__?.gemini) return w.__RITUAL_KEYS__.gemini as string;
            } catch { }
            try {
                const val = localStorage.getItem('ai_api_key_gemini');
                if (val) return val;
            } catch { }
            return null;

        case 'openrouter':
        case 'deepseek':
            // For deepseek through OpenRouter, use OpenRouter key
            if (env.VITE_OPENROUTER_API_KEY) return env.VITE_OPENROUTER_API_KEY as string;
            if (env.VITE_DEEPSEEK_API_KEY) return env.VITE_DEEPSEEK_API_KEY as string;
            try {
                const w = window as any;
                if (w.__RITUAL_KEYS__?.openrouter) return w.__RITUAL_KEYS__.openrouter as string;
                if (w.__RITUAL_KEYS__?.deepseek) return w.__RITUAL_KEYS__.deepseek as string;
            } catch { }
            try {
                const val = localStorage.getItem('ai_api_key_openrouter');
                if (val) return val;
                const val2 = localStorage.getItem('ai_api_key_deepseek');
                if (val2) return val2;
            } catch { }
            return null;

        default:
            return null;
    }
}

export function getDefaultModel(provider: AiProvider): string {
    if (provider === 'gemini') return 'gemini-2.0-flash';
    // DeepSeek R1 0528 FREE through OpenRouter
    if (provider === 'openrouter' || provider === 'deepseek') return 'deepseek/deepseek-r1-0528:free';
    return 'deepseek/deepseek-r1-0528:free';
}

export async function chat(req: ChatRequest): Promise<string> {
    const { provider, messages } = req;

    if (provider === 'gemini') {
        // Use Supabase Edge Function for secure API calls
        const { supabase } = await import('@/integrations/supabase/client');
        const model = req.model || getDefaultModel(provider);

        const { data, error } = await supabase.functions.invoke('ai-chat', {
            body: { messages, model }
        });

        if (error) {
            console.error('Edge function error:', error);
            throw new Error(`AI Chat error: ${error.message}`);
        }

        return data?.reply || 'No response generated';
    }

    // Use OpenRouter for DeepSeek
    if (provider === 'deepseek' || provider === 'openrouter') {
        const apiKey = getEnvKey('openrouter');
        if (!apiKey || apiKey === 'your-openrouter-api-key-here') {
            throw new Error('Missing OpenRouter API key. Please add VITE_OPENROUTER_API_KEY to your .env file.');
        }

        const model = req.model || getDefaultModel(provider);
        const url = 'https://openrouter.ai/api/v1/chat/completions';

        const body = {
            model,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content
            }))
        };

        console.log('Calling OpenRouter with model:', model);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Ritual Reader'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('OpenRouter error:', res.status, errorData);
            throw new Error(`OpenRouter error: ${res.status} - ${errorData?.error?.message || 'Unknown error'}`);
        }

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || '';

        // DeepSeek R1 may include reasoning in <think> tags, strip them for cleaner output
        const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        return cleanText || text;
    }

    throw new Error('Unsupported provider');
}
