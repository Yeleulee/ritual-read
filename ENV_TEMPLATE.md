# Environment Variables Template

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://liqdfaxmmqpovjptmaxe.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcWRmYXhtbXFwb3ZqcHRtYXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3MDA1NzIsImV4cCI6MjA3MzI3NjU3Mn0.z8M6IHHaueOl_ZLfkvd_r_Hd_OAmmLZ9B7L3aGQv_XE

# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyA7RtnCwp_oaQJ6ezJSykZDnJ9yvrkS1sQ
VITE_FIREBASE_AUTH_DOMAIN=ritual-5141b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ritual-5141b
VITE_FIREBASE_STORAGE_BUCKET=ritual-5141b.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=545843037917
VITE_FIREBASE_APP_ID=1:545843037917:web:83a43a57a2032bef5b7d34
VITE_FIREBASE_MEASUREMENT_ID=G-J0PLYCC7GX

# YouTube API (Optional - for music search feature)
# Get your API key from: https://console.cloud.google.com/apis/credentials
VITE_YOUTUBE_API_KEY=your-youtube-api-key-here

# AI API Keys (Optional - for AI chat feature)
# Gemini API Key: https://makersuite.google.com/app/apikey
VITE_GEMINI_API_KEY=your-gemini-api-key-here
# DeepSeek API Key: https://platform.deepseek.com/
VITE_DEEPSEEK_API_KEY=your-deepseek-api-key-here

# Supabase Functions URL (Optional - for server-side API calls)
VITE_SUPABASE_FUNCTIONS_URL=https://liqdfaxmmqpovjptmaxe.supabase.co/functions/v1
```

## 🔒 Security Notes

**Public vs Private Keys:**

- ✅ **Safe for client-side** (can be in .env):
  - `VITE_SUPABASE_URL` - Public URL
  - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key (designed to be public)
  - `VITE_FIREBASE_*` - Firebase config (designed for client-side apps)

- ⚠️ **Keep private** (never commit):
  - `VITE_YOUTUBE_API_KEY` - Has usage quotas
  - `VITE_GEMINI_API_KEY` - Has usage costs
  - `VITE_DEEPSEEK_API_KEY` - Has usage costs

**Important:**
- ✅ `.env` is already in `.gitignore` 
- ✅ Never commit `.env` to version control
- ✅ Use environment variables in Vercel/deployment platforms
- ✅ Rotate API keys if accidentally exposed

