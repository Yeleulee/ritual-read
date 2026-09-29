import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Dev-only: when Supabase isn't configured (or explicitly requested), run with a local fake session
// so the app is usable without credentials. Never active in production builds.
export const DEV_AUTH_BYPASS =
  import.meta.env.DEV &&
  (import.meta.env.VITE_DEV_AUTH_BYPASS === 'true' || !import.meta.env.VITE_SUPABASE_URL);

const DEV_SESSION_KEY = 'ritual:dev-session';

const devUser = {
  id: 'local-dev-user',
  email: 'you@localhost',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: { provider: 'local' },
  user_metadata: { full_name: 'Local Reader' },
  created_at: new Date(0).toISOString(),
} as unknown as User;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (DEV_AUTH_BYPASS) {
      // Signed in by default; sign-out only clears the flag until next sign-in
      const signedOut = localStorage.getItem(DEV_SESSION_KEY) === 'out';
      setUser(signedOut ? null : devUser);
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const devSignIn = () => {
    localStorage.setItem(DEV_SESSION_KEY, 'in');
    setUser(devUser);
    return { error: null };
  };

  const signUp = async (email: string, password: string) => {
    if (DEV_AUTH_BYPASS) return devSignIn();
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    if (DEV_AUTH_BYPASS) return devSignIn();
    console.log('Attempting sign in for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error.message, error);
    } else {
      console.log('Sign in successful:', data.user?.email);
    }

    return { error };
  };

  const signInWithGoogle = async () => {
    if (DEV_AUTH_BYPASS) return devSignIn();
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });

      if (error) {
        console.error('Google OAuth error:', error);
        return { error };
      }

      return { error: null, data };
    } catch (err) {
      console.error('Google OAuth exception:', err);
      return { error: err };
    }
  };

  const signOut = async () => {
    if (DEV_AUTH_BYPASS) {
      localStorage.setItem(DEV_SESSION_KEY, 'out');
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
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
