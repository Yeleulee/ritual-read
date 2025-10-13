# Google Authentication Setup Guide

## ✅ Implementation Complete
The Google login functionality has been implemented with:
- ✅ Google OAuth sign-in button
- ✅ Error handling and user feedback
- ✅ Seamless redirect flow
- ✅ Session persistence
- ✅ User-friendly error messages

## Supabase Configuration

Your app uses **Supabase** for authentication. Follow these steps to configure Google OAuth:

### 1. Configure Google OAuth in Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project: **liqdfaxmmqpovjptmaxe**
3. Navigate to **Authentication** → **Providers**
4. Find **Google** in the list of providers
5. Click to enable it and configure:
   - **Enable Google provider**: Toggle ON
   - **Client ID**: Paste your Google OAuth Client ID
   - **Client Secret**: Paste your Google OAuth Client Secret
6. Click **Save**

### 2. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
5. Select **Web application**
6. Configure:
   - **Name**: Ritual Reader (or your app name)
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (for local development)
     - `http://localhost:3000` (alternative local port)
     - Your production domain (e.g., `https://your-app.com`)
   - **Authorized redirect URIs**:
     - `https://liqdfaxmmqpovjptmaxe.supabase.co/auth/v1/callback`
     - Any additional production redirect URIs
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

### 3. Configure OAuth Consent Screen

1. In Google Cloud Console, go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (or Internal if using Google Workspace)
3. Fill in required information:
   - **App name**: Ritual Reader
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Add scopes (recommended):
   - `userinfo.email`
   - `userinfo.profile`
5. Save and continue

### 4. Configure Supabase Redirect URLs

1. In Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add your redirect URLs:
   - **Site URL**: Your production URL (e.g., `https://your-app.com`)
   - **Redirect URLs** (one per line):
     - `http://localhost:5173`
     - `http://localhost:3000`
     - Your production domain

## Testing the Implementation

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Test Google Sign-In:**
   - Navigate to the login page
   - Click "Continue with Google" button
   - Select your Google account
   - Grant permissions if prompted
   - You should be redirected back and signed in

3. **Check Browser Console** (F12) for any errors or logs

## How It Works

The implementation includes:

1. **AuthForm Component** (`src/components/AuthForm.tsx`):
   - "Continue with Google" button on both Sign In and Sign Up tabs
   - Loading states during OAuth flow
   - Error handling with toast notifications

2. **Auth Hook** (`src/hooks/use-auth.tsx`):
   - `signInWithGoogle()` function that handles OAuth flow
   - Automatic redirect to Google
   - Session management after successful authentication

3. **Supabase Integration** (`src/integrations/supabase/client.ts`):
   - Configured with your Supabase URL and key
   - Persistent session storage
   - Auto token refresh

## Common Issues & Solutions

### "This domain is not authorized"
- Add your domain to Google Cloud Console authorized origins
- Add your domain to Supabase redirect URLs

### "Invalid redirect URI"
- Verify the Supabase callback URL in Google Cloud Console
- Format: `https://[PROJECT_REF].supabase.co/auth/v1/callback`

### Google popup closes without signing in
- Check browser console for specific errors
- Verify Google OAuth credentials are correct in Supabase
- Try in incognito mode to rule out browser extensions

### "Failed to fetch" or network errors
- Check internet connection
- Verify Supabase project is active
- Check if Google OAuth is enabled in Supabase

## Current Configuration

- **Supabase Project**: liqdfaxmmqpovjptmaxe
- **Supabase URL**: https://liqdfaxmmqpovjptmaxe.supabase.co
- **OAuth Redirect URI**: `https://liqdfaxmmqpovjptmaxe.supabase.co/auth/v1/callback`

## Files Implementing Google Login

- `src/components/AuthForm.tsx` - Login UI with Google button
- `src/hooks/use-auth.tsx` - Authentication logic
- `src/integrations/supabase/client.ts` - Supabase configuration

