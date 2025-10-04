# Google Authentication Setup Guide

## Issue Fixed
The Google login functionality has been updated with:
- ✅ Better error handling and logging
- ✅ Improved popup/redirect flow
- ✅ Redirect result handling after authentication
- ✅ User-friendly error messages
- ✅ Google Provider configuration for better UX

## Firebase Console Configuration

To ensure Google authentication works properly, verify these settings in your Firebase Console:

### 1. Enable Google Sign-In Provider

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **ritual-5141b**
3. Navigate to **Authentication** → **Sign-in method**
4. Find **Google** in the list of providers
5. Click **Enable** if not already enabled
6. Set your **Project support email**
7. Click **Save**

### 2. Configure Authorized Domains

1. In **Authentication** → **Settings** → **Authorized domains**
2. Ensure these domains are added:
   - `localhost` (for local development)
   - Your production domain (e.g., `your-app.com`)
   - Your deployment domain (if using services like Vercel, Netlify, etc.)

### 3. OAuth Consent Screen (Google Cloud Console)

If you encounter "unauthorized_client" errors:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **OAuth consent screen**
4. Configure the consent screen:
   - Add your app name
   - Add support email
   - Add authorized domains
5. Go to **Credentials**
6. Find your OAuth 2.0 Client ID
7. Add authorized redirect URIs:
   - `https://ritual-5141b.firebaseapp.com/__/auth/handler`
   - `http://localhost` (for local development)
   - Your production domain callback URLs

## Testing the Fix

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open the browser console** (F12) to see authentication logs:
   - "Attempting Google sign-in with popup..."
   - "Google sign-in successful!" (on success)
   - Or specific error messages (on failure)

3. **Try signing in with Google:**
   - Click "Continue with Google" button
   - Select your Google account
   - Grant permissions if prompted

## Common Error Messages

The app now provides user-friendly error messages:

- **"Sign-in popup was closed"** → User closed the popup before completing sign-in
- **"This domain is not authorized"** → Need to add domain to Firebase Authorized Domains
- **"Google sign-in is not enabled"** → Enable Google provider in Firebase Console
- **"Network error"** → Check internet connection

## Debug Mode

The authentication flow now includes console logging for debugging:
- Check browser console (F12) for detailed error messages
- Look for error codes like `auth/popup-closed-by-user`, `auth/unauthorized-domain`, etc.

## Support

If you continue to experience issues:

1. Check the browser console for specific error codes
2. Verify Firebase configuration is correct
3. Ensure all authorized domains are added
4. Check that Google OAuth client is properly configured in Google Cloud Console
5. Try in incognito mode to rule out browser extension conflicts

## Files Modified

- `src/lib/firebase-auth-helpers.ts` - Enhanced error handling and logging
- `src/hooks/use-auth.tsx` - Added redirect result handling
- `src/components/AuthForm.tsx` - Improved error messages

