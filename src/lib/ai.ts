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
  const apiKey = getEnvKey(provider);
  if (!apiKey) throw new Error('Missing API key for provider');

  if (provider === 'gemini') {
    // Google Generative Language API (Gemini)
    const model = req.model || getDefaultModel(provider);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const body = { contents } as any;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
  }

  if (provider === 'deepseek') {
    // DeepSeek (OpenAI-compatible API)
    const model = req.model || getDefaultModel(provider);
    const url = 'https://api.deepseek.com/v1/chat/completions';
    const body = { model, messages };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`DeepSeek error: ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return text;
  }

  throw new Error('Unsupported provider');
}


