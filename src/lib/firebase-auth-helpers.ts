import { firebaseApp } from '@/lib/firebase';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult as firebaseGetRedirectResult,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';

const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

// Configure Google Provider for better UX
googleProvider.setCustomParameters({
  prompt: 'select_account', // Forces account selection even if user has one account
});

export const signUpWithEmail = async (email: string, password: string) => {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    return { error: null };
  } catch (error: any) {
    console.error('Email signup error:', error);
    return { error };
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { error: null };
  } catch (error: any) {
    console.error('Email signin error:', error);
    return { error };
  }
};

export const signInWithGoogle = async () => {
  try {
    console.log('Attempting Google sign-in with popup...');
    await signInWithPopup(auth, googleProvider);
    console.log('Google sign-in successful!');
    return { error: null };
  } catch (popupError: any) {
    console.error('Google popup error:', popupError.code, popupError.message);
    
    // Only attempt redirect if popup was specifically blocked
    if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/cancelled-popup-request') {
      console.log('Popup blocked, attempting redirect...');
      try {
        await signInWithRedirect(auth, googleProvider);
        return { error: null };
      } catch (redirectError: any) {
        console.error('Google redirect error:', redirectError);
        return { error: redirectError };
      }
    }
    
    // Return the original error for other cases
    return { error: popupError };
  }
};

export const firebaseSignOut = async () => {
  await signOut(auth);
};

export const onAuthStateChange = (cb: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, cb);
};

export const getCurrentUser = () => auth.currentUser;

export const getRedirectResult = async () => {
  try {
    console.log('Checking for redirect result...');
    const result = await firebaseGetRedirectResult(auth);
    if (result) {
      console.log('Redirect result found:', result.user.email);
    }
    return result;
  } catch (error: any) {
    console.error('Redirect result error:', error);
    throw error;
  }
};


