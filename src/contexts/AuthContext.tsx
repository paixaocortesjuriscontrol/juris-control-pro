import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; isInactive?: boolean }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Check if user is active in the profiles table
async function checkUserActive(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("ativo")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error checking user active status:", error);
    return true; // Allow access if we can't check (fail open for existing users)
  }

  // If no profile found, allow access (new user)
  if (!data) {
    return true;
  }

  return data.ativo === true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        // Synchronous state updates only
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Defer the active check to avoid deadlocks
        if (currentSession?.user && event === "SIGNED_IN") {
          setTimeout(async () => {
            const isActive = await checkUserActive(currentSession.user.id);
            if (!isActive) {
              toast.error("Sua conta está desativada. Entre em contato com o administrador.");
              await supabase.auth.signOut();
            }
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);

      // Check if existing session user is active
      if (existingSession?.user) {
        const isActive = await checkUserActive(existingSession.user.id);
        if (!isActive) {
          toast.error("Sua conta está desativada. Entre em contato com o administrador.");
          await supabase.auth.signOut();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    // Check if user is active after successful authentication
    if (data.user) {
      const isActive = await checkUserActive(data.user.id);
      if (!isActive) {
        // Sign out the user immediately
        await supabase.auth.signOut();
        return { 
          error: new Error("Sua conta está desativada. Entre em contato com o administrador."),
          isInactive: true 
        };
      }

      // Record login history
      try {
        await supabase.from("historico_login").insert({
          user_id: data.user.id,
          email: data.user.email,
        });
      } catch (e) {
        console.error("Error recording login history:", e);
      }
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    // Atualiza o estado local imediatamente para garantir redirecionamento no mobile
    setSession(null);
    setUser(null);

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
