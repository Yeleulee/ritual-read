import { firebaseApp } from '@/lib/firebase';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';

const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

export const signUpWithEmail = async (email: string, password: string) => {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

export const signInWithGoogle = async () => {
  try {
    // Prefer popup; fallback to redirect on environments where popup is blocked
    await signInWithPopup(auth, googleProvider);
    return { error: null };
  } catch (popupError: any) {
    try {
      await signInWithRedirect(auth, googleProvider);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }
};

export const firebaseSignOut = async () => {
  await signOut(auth);
};

export const onAuthStateChange = (cb: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, cb);
};

export const getCurrentUser = () => auth.currentUser;


