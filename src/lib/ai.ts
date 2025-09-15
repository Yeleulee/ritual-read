export type AiProvider = 'gemini' | 'deepseek';

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
  const fromEnv = provider === 'gemini' ? env.VITE_GEMINI_API_KEY : env.VITE_DEEPSEEK_API_KEY;
  if (fromEnv) return fromEnv as string;
  // Secondary: window global (user can inject at runtime without UI)
  try {
    const w: any = window as any;
    if (provider === 'gemini' && w.__RITUAL_KEYS__?.gemini) return w.__RITUAL_KEYS__.gemini as string;
    if (provider === 'deepseek' && w.__RITUAL_KEYS__?.deepseek) return w.__RITUAL_KEYS__.deepseek as string;
  } catch {}
  // Tertiary: localStorage (not shown in UI but can be set manually)
  try {
    const lsKey = provider === 'gemini' ? 'ai_api_key_gemini' : 'ai_api_key_deepseek';
    const val = localStorage.getItem(lsKey);
    if (val) return val;
  } catch {}
  return null;
}

export function getDefaultModel(provider: AiProvider): string {
  return provider === 'gemini' ? 'gemini-2.0-flash' : 'deepseek-chat';
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

  if (provider === 'deepseek') {
    // Fallback to client-side for DeepSeek (less secure but functional)
    const apiKey = getEnvKey(provider);
    if (!apiKey) throw new Error('Missing API key for provider');
    
    const model = req.model || getDefaultModel(provider);
    const url = 'https://api.deepseek.com/v1/chat/completions';
    const body = { model, messages };
    const res = await fetch(url, { 
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiKey}` 
      }, 
      body: JSON.stringify(body) 
    });
    
    if (!res.ok) throw new Error(`DeepSeek error: ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return text;
  }

  throw new Error('Unsupported provider');
}


