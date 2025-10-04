# Firebase Setup Guide

Firebase has been successfully integrated into your Ritual Reader app! 🔥

## ✅ What's Been Configured

1. **Firebase SDK** - Installed and initialized
2. **Firebase Auth** - Ready to use
3. **Firebase Analytics** - Ready to track events
4. **Helper Functions** - Pre-built auth functions in `src/lib/firebase-auth-helpers.ts`

## 📁 Files Created

- `src/lib/firebase.ts` - Firebase configuration and initialization
- `src/lib/firebase-auth-helpers.ts` - Helper functions for authentication
- `src/main.tsx` - Updated to initialize Firebase on app load

## 🔥 Firebase Configuration

Your Firebase project is configured with:
- **Project ID**: ritual-5141b
- **Auth Domain**: ritual-5141b.firebaseapp.com
- **Storage Bucket**: ritual-5141b.firebasestorage.app

## 🚀 How to Use Firebase Auth

### Option 1: Keep Supabase (Current Setup)

Your app currently uses Supabase for authentication. Firebase is available for:
- Analytics tracking
- Cloud storage (if you want to migrate from Supabase storage)
- Additional Firebase services

### Option 2: Switch to Firebase Auth

If you want to replace Supabase Auth with Firebase Auth:

#### 1. Enable Authentication Methods in Firebase Console

Go to: https://console.firebase.google.com/project/ritual-5141b/authentication/providers

Enable:
- ✅ Email/Password
- ✅ Google Sign-In

#### 2. Update `use-auth.tsx` to use Firebase

Replace the Supabase auth calls with Firebase:

```typescript
import { signInWithEmail, signUpWithEmail, signOut, onAuthStateChange } from '@/lib/firebase-auth-helpers';

// In your AuthProvider:
const signIn = async (email: string, password: string) => {
  const { user, error } = await signInWithEmail(email, password);
  return { error };
};

const signUp = async (email: string, password: string) => {
  const { user, error } = await signUpWithEmail(email, password);
  return { error };
};
```

#### 3. Add Google Sign-In Back (Optional)

In `AuthForm.tsx`:

```typescript
import { signInWithGoogle } from '@/lib/firebase-auth-helpers';

const handleGoogleSignIn = async () => {
  const { user, error } = await signInWithGoogle();
  if (error) {
    toast({ title: "Error", description: error, variant: "destructive" });
  }
};
```

## 📊 Firebase Analytics

Track user events:

```typescript
import { analytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';

// Track when user opens a book
logEvent(analytics, 'book_opened', {
  book_title: 'My Book',
  book_id: '123'
});

// Track reading session
logEvent(analytics, 'reading_session', {
  duration_minutes: 15
});
```

## 🔐 Google OAuth Setup (If Switching to Firebase)

1. **Firebase Console** (already configured):
   - Go to Authentication → Sign-in method
   - Enable Google provider
   - Copy the Web Client ID

2. **Google Cloud Console**:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Find your OAuth 2.0 Client
   - Add **Authorized JavaScript origins**:
     ```
     http://localhost:8081
     https://ritual-read.vercel.app
     ```
   - Add **Authorized redirect URIs**:
     ```
     https://ritual-5141b.firebaseapp.com/__/auth/handler
     http://localhost:8081
     https://ritual-read.vercel.app
     ```

## 🎯 Current Status

- ✅ Firebase installed and initialized
- ✅ Firebase Auth helpers created
- ✅ Firebase Analytics ready
- ⏳ Still using Supabase for authentication (default)

## 📝 Next Steps (Choose One)

**A. Keep using Supabase Auth** (Recommended if it's working)
- Just use Firebase for analytics and other services
- No changes needed to your auth flow

**B. Switch to Firebase Auth**
- Follow the "Switch to Firebase Auth" section above
- Enable auth methods in Firebase Console
- Update `use-auth.tsx` hook
- Test authentication flows

## 📚 Resources

- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Firebase Analytics Docs](https://firebase.google.com/docs/analytics)
- [Firebase Console](https://console.firebase.google.com/project/ritual-5141b)

---

**Need help?** Let me know what you'd like to do with Firebase!

