import * as React from 'react';
import { backendClient, type AuthSessionCompat, type AuthUserCompat } from '@/integrations/backend/client';

interface AuthContextType {
  user: AuthUserCompat | null;
  session: AuthSessionCompat | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUserCompat | null>(null);
  const [session, setSession] = React.useState<AuthSessionCompat | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const { data: { subscription } } = backendClient.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      }
    );

    backendClient.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await backendClient.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await backendClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name }
      }
    });

    const normalizedMessage = error?.message.toLowerCase() ?? '';
    if (error && (normalizedMessage.includes('email-already-in-use') || normalizedMessage.includes('email already in use'))) {
      const loginResult = await backendClient.auth.signInWithPassword({ email, password });
      if (!loginResult.error) {
        return { error: null };
      }
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await backendClient.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

