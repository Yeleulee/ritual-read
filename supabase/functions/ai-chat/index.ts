import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json() as { messages?: ChatMessage[] };

    if (!Array.isArray(messages) || !messages.length || messages.some((message) =>
      !message || !['user', 'assistant', 'system'].includes(message.role) || typeof message.content !== 'string'
    )) {
      return new Response(JSON.stringify({ error: 'A valid messages array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment');
    }

    const system = messages.filter((message) => message.role === 'system');
    let turns = messages.filter((message) => message.role !== 'system').slice(-40);
    const size = (items: ChatMessage[]) => items.reduce((total, message) => total + message.content.length, 0);
    while (turns.length > 1 && size(system) + size(turns) > 60_000) turns = turns.slice(1);
    if (!turns.length || size(system) + size(turns) > 60_000) {
      return new Response(JSON.stringify({ error: 'Message too long or no conversation turns provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
    for (const message of turns) {
      if (!message.content.trim()) continue;
      const role = message.role === 'assistant' ? 'model' : 'user';
      const last = contents[contents.length - 1];
      if (last?.role === role) last.parts.push({ text: message.content });
      else contents.push({ role, parts: [{ text: message.content }] });
    }
    const systemText = system.map((message) => message.content).join('\n\n');
    let reply = '';
    for (const model of ['gemini-2.5-flash', 'gemini-flash-latest']) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
          signal: AbortSignal.timeout(40_000),
          body: JSON.stringify({
            ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
              ...(model === 'gemini-2.5-flash' ? { thinkingConfig: { thinkingBudget: 1024 } } : {}),
            },
          }),
        });
        if (!response.ok) continue;
        const data = await response.json() as {
          candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
        };
        reply = (data.candidates?.[0]?.content?.parts ?? [])
          .filter((part) => !part.thought && typeof part.text === 'string')
          .map((part) => part.text)
          .join('')
          .trim();
        if (reply) break;
      } catch {
        console.error('Gemini request failed for model:', model);
      }
    }
    if (!reply) throw new Error('The assistant could not generate a reply. Try again.');

    console.log('Successfully generated AI response');

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred while processing your request'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});