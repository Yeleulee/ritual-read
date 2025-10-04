import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle as firebaseSignInWithGoogle,
  firebaseSignOut,
  onAuthStateChange,
  getCurrentUser,
  getRedirectResult,
} from '@/lib/firebase-auth-helpers';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for redirect result first (for Google redirect flow)
    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult();
        if (result) {
          // User successfully signed in via redirect
          setUser(result.user);
        } else {
          // No redirect result, check current user
          setUser(getCurrentUser());
        }
      } catch (error) {
        console.error('Error handling redirect result:', error);
        setUser(getCurrentUser());
      } finally {
        setLoading(false);
      }
    };

    checkRedirectResult();

    const unsubscribe = onAuthStateChange((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await signUpWithEmail(email, password);
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await signInWithEmail(email, password);
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await firebaseSignInWithGoogle();
    return { error };
  };

  const signOut = async () => {
    await firebaseSignOut();
  };

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
