# Security Best Practices

## ✅ What We've Secured

All API keys and secrets have been moved to environment variables:

1. ✅ **Firebase Configuration** - Uses `VITE_FIREBASE_*` env vars
2. ✅ **Supabase Configuration** - Uses `VITE_SUPABASE_*` env vars  
3. ✅ **YouTube API** - Uses `VITE_YOUTUBE_API_KEY` env var
4. ✅ **AI APIs** - Uses `VITE_GEMINI_API_KEY` and `VITE_DEEPSEEK_API_KEY` env vars

## 🔒 Environment Variables Setup

### Local Development

1. Copy the template from `ENV_TEMPLATE.md`
2. Create a `.env` file in the root directory
3. Fill in your API keys
4. Restart your dev server (`npm run dev`)

### Production (Vercel)

1. Go to: https://vercel.com/your-project/settings/environment-variables
2. Add all `VITE_*` variables from your `.env` file
3. Click "Save"
4. Redeploy your app

## 🛡️ Security Measures in Place

### 1. `.gitignore` Protection
```
.env
.env.*
!.env.example
```
This prevents accidentally committing secrets to Git.

### 2. Environment Variable Validation

The app validates required environment variables on startup:
- Supabase client checks for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Firebase checks for all required config values

### 3. Server-Side API Calls (Recommended)

Sensitive API calls (like AI chat) use Supabase Edge Functions:
- ✅ API keys are stored server-side
- ✅ No exposure in client-side code
- ✅ Better rate limiting and security

## 🔑 API Key Safety Levels

### Public Keys (Safe for client-side)
These are **designed** to be used in client-side apps:

- ✅ `VITE_SUPABASE_ANON_KEY` - Protected by Row Level Security (RLS)
- ✅ `VITE_FIREBASE_*` - Protected by Firebase Security Rules

**Note:** Even though these are "public," using env vars allows you to:
- Rotate keys easily without code changes
- Use different keys for dev/staging/production

### Private Keys (Keep secret)
These should **never** be exposed:

- 🔒 `VITE_YOUTUBE_API_KEY` - Has usage quotas
- 🔒 `VITE_GEMINI_API_KEY` - Costs money per request
- 🔒 `VITE_DEEPSEEK_API_KEY` - Costs money per request

**Best Practice:** Use Supabase Edge Functions for these APIs!

## ⚠️ What to Do If a Key is Exposed

If you accidentally commit an API key:

### 1. Revoke the Key Immediately

**YouTube API:**
- Go to: https://console.cloud.google.com/apis/credentials
- Delete the exposed key
- Create a new one

**Firebase:**
- Go to: https://console.firebase.google.com/project/ritual-5141b/settings/general
- Regenerate keys if needed
- Update security rules

**Supabase:**
- Go to: https://supabase.com/dashboard/project/liqdfaxmmqpovjptmaxe/settings/api
- Generate new anon key
- Update RLS policies

**AI APIs:**
- Gemini: https://makersuite.google.com/app/apikey
- DeepSeek: https://platform.deepseek.com/

### 2. Remove from Git History

```bash
# Remove file from all commits
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (be careful!)
git push origin --force --all
```

### 3. Update Environment Variables

- Update `.env` locally
- Update Vercel environment variables
- Redeploy

## 🎯 Deployment Checklist

Before deploying to production:

- [ ] `.env` is not committed to Git
- [ ] All required env vars are set in Vercel
- [ ] API keys are rotated from development keys
- [ ] Firebase Security Rules are configured
- [ ] Supabase RLS policies are enabled
- [ ] Rate limiting is configured for APIs
- [ ] CORS is properly configured

## 📚 Additional Resources

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

**Last Updated:** Security measures implemented to protect all API keys and secrets.
