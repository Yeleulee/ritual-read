// Firebase Authentication Helper Functions
// Use these functions to implement Firebase Auth in your app

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { auth } from "./firebase";

// Google OAuth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Sign in with Email and Password
 */
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

/**
 * Sign up with Email and Password
 */
export const signUpWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

/**
 * Sign in with Google (Popup)
 */
export const signInWithGoogle = async () => {
  try {
    // First try popup for better UX
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error: any) {
    // Fallback to redirect if popup is blocked or not allowed
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/unauthorized-domain') {
      try {
        await signInWithRedirect(auth, googleProvider);
        // After redirect back, getRedirectResult will complete the sign-in
        const res = await getRedirectResult(auth);
        if (res?.user) return { user: res.user, error: null };
        return { user: null, error: null };
      } catch (redirectErr: any) {
        return { user: null, error: redirectErr.message };
      }
    }
    return { user: null, error: error?.message || 'Google sign-in failed' };
  }
};

/**
 * Sign out
 */
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

/**
 * Listen to auth state changes
 * Usage: 
 * const unsubscribe = onAuthStateChange((user) => {
 *   if (user) {
 *     console.log("User is signed in:", user);
 *   } else {
 *     console.log("User is signed out");
 *   }
 * });
 */
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Get current user
 */
export const getCurrentUser = () => {
  return auth.currentUser;
};

