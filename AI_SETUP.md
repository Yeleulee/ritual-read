# AI Chat Setup Guide

## 🤖 Overview

The AI Assistant uses Google Gemini to help you understand and discuss your reading material. It can answer questions about the current page, summarize content, and provide insights.

## ✅ Quick Setup (5 minutes)

### Step 1: Get a Free API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key (starts with `AIza...`)

**Note**: Gemini offers a generous free tier with no credit card required!

### Step 2: Add Key to Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to: **Edge Functions** → **Manage secrets**
4. Click "New secret"
5. Set:
   - Name: `GEMINI_API_KEY`
   - Value: Paste your API key
6. Click "Save"

### Step 3: Deploy Edge Function (if not deployed)

If you haven't deployed the edge function yet:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the edge function
supabase functions deploy ai-chat
```

### Step 4: Test the AI

1. Open any book in your library
2. Click "Ask AI" button
3. Type a question about your reading
4. The AI will respond with context-aware answers!

---

## 🔧 Troubleshooting

### "API Key Not Configured" Error

**Problem**: The Gemini API key isn't set in Supabase.

**Solution**:
- Follow Step 2 above to add the API key
- Make sure the secret name is exactly `GEMINI_API_KEY`
- Redeploy the edge function after adding the key

### "Connection Error" Message

**Possible causes**:
1. **Edge function not deployed**: Run `supabase functions deploy ai-chat`
2. **Internet connection**: Check your network
3. **Supabase project inactive**: Visit your Supabase dashboard to wake it up
4. **API key invalid**: Generate a new key from Google AI Studio

### AI Chat Not Visible on Laptop

**Fixed!** The AI chat now shows on screens 768px and wider (tablets and laptops). Click "Ask AI" to open it.

### Slow Responses

**Normal**: First response may take 2-5 seconds. Subsequent responses are faster.

**If consistently slow**:
- Check your internet speed
- Try during off-peak hours
- Consider upgrading Supabase plan for better performance

---

## 💡 Usage Tips

### Best Practices

1. **Be specific**: "Explain the main theme on this page" works better than "What's this about?"
2. **Use context**: The AI sees the current page you're reading
3. **Ask follow-ups**: Continue the conversation for deeper insights
4. **Clear chat**: Use the refresh button to start fresh discussions

### Example Questions

- "Summarize the key points on this page"
- "What does [term] mean in this context?"
- "How does this relate to the previous chapter?"
- "Can you explain this concept in simpler terms?"
- "What are the main arguments presented here?"

### Keyboard Shortcuts

- **Enter**: Send message
- **Shift + Enter**: New line in message
- **Esc**: Close AI chat panel

---

## 🔒 Privacy & Security

### Your Data
- **Reading content**: Sent to Gemini API for context (only current page)
- **Chat history**: Stored locally in your browser
- **Files**: Never uploaded to Gemini (only text snippets)

### API Key Security
- **Stored in**: Supabase Edge Functions (server-side)
- **Not exposed**: Your browser never sees the API key
- **Secure**: Uses Supabase's encrypted secrets storage

### Google Gemini
- Free tier: Rate limited but sufficient for personal use
- Enterprise: Available for commercial deployments
- Terms: [Google Gemini Terms of Service](https://ai.google.dev/terms)

---

## 📊 API Usage & Limits

### Free Tier (Gemini)
- **Requests**: 60 requests per minute
- **Cost**: Free forever
- **Input tokens**: Unlimited
- **Output tokens**: Unlimited

### If You Hit Limits
- Wait a minute for rate limit to reset
- Reduce message frequency
- Consider paid tier for higher limits

---

## 🌟 Advanced Configuration

### Using DeepSeek (Alternative)

DeepSeek is an alternative AI provider with competitive pricing.

1. Get API key from [DeepSeek Platform](https://platform.deepseek.com/)
2. Add to Supabase secrets: `DEEPSEEK_API_KEY`
3. Update edge function or use client-side integration
4. Switch provider in AI chat settings

### Custom Models

Edit `src/lib/ai.ts` to use different models:

```typescript
export function getDefaultModel(provider: AiProvider): string {
  return provider === 'gemini' 
    ? 'gemini-2.0-flash'  // Fast, balanced
    // ? 'gemini-pro'      // More capable, slower
    : 'deepseek-chat';
}
```

### Offline Mode

AI chat requires internet. For offline reading:
- AI features will be unavailable
- All other reading features work normally
- Chat history remains accessible

---

## 🆘 Still Having Issues?

### Check These First
1. ✅ API key is correctly added to Supabase
2. ✅ Edge function is deployed (`supabase functions list`)
3. ✅ You're connected to internet
4. ✅ Browser console shows no errors (F12 → Console)

### Get Help
- Check browser console for detailed error messages
- Review Supabase edge function logs
- Verify API key is valid at Google AI Studio
- Test API key with a simple curl request

### Example Test Request

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

Expected: JSON response with AI-generated text

---

## 📝 Notes

- **First-time setup**: ~5 minutes
- **Ongoing cost**: Free (Gemini) or minimal (DeepSeek)
- **Performance**: Fast responses (1-3 seconds)
- **Availability**: 24/7 with internet connection
- **Updates**: Edge function auto-updates with deployments

Enjoy your enhanced reading experience with AI assistance! 🎉
