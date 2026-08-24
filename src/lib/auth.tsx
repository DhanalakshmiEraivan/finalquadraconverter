import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import type {
  Session,
  User,
} from '@supabase/supabase-js';

import {
  supabase,
  type Profile,
  type UserRole,
} from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;

  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;

  signUp: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{ error: string | null }>;

  signInWithGoogle: () => Promise<{
    error: string | null;
  }>;

  resetPassword: (
    email: string
  ) => Promise<{ error: string | null }>;

  updatePassword: (
    password: string
  ) => Promise<{ error: string | null }>;

  signOut: () => Promise<void>;

  refreshProfile: () => Promise<void>;
}

const AuthContext =
  createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] =
    useState<Session | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [loading, setLoading] =
    useState(true);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    setProfile(data as Profile | null);
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(currentSession);

        if (currentSession?.user) {
          await fetchProfile(
            currentSession.user.id
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        setSession(currentSession);

        /*
         * PASSWORD_RECOVERY is fired by Supabase after the
         * recovery link has successfully established the
         * temporary authenticated recovery session.
         */
        if (
          event === 'PASSWORD_RECOVERY' &&
          currentSession?.user
        ) {
          await fetchProfile(
            currentSession.user.id
          );

          setLoading(false);
          return;
        }

        if (currentSession?.user) {
          await fetchProfile(
            currentSession.user.id
          );
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (
    email: string,
    password: string
  ) => {
    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    return {
      error: error?.message ?? null,
    };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName?: string
  ) => {
    const {
      data,
      error,
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return {
        error: error.message,
      };
    }

    if (data.user) {
      await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          email,
        })
        .eq('id', data.user.id);
    }

    return {
      error: null,
    };
  };

  const signInWithGoogle = async () => {
    const redirectTo =
      `${window.location.origin}/`;

    const {
      error,
    } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    return {
      error: error?.message ?? null,
    };
  };

  /*
   * Starts secure password recovery.
   *
   * Supabase sends the recovery link.
   * The link establishes a temporary recovery session.
   * ResetPasswordPage then allows the user to enter:
   *
   * New Password
   * Confirm Password
   */
  const resetPassword = async (
    email: string
  ) => {
    const redirectTo =
      `${window.location.origin}/?reset=1`;

    const {
      error,
    } =
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo,
        }
      );

    return {
      error: error?.message ?? null,
    };
  };

  /*
   * This updates auth.users.password.
   *
   * IMPORTANT:
   * It only works when Supabase has already created
   * an authenticated recovery session.
   */
  const updatePassword = async (
    password: string
  ) => {
    const {
      data: {
        session: currentSession,
      },
    } = await supabase.auth.getSession();

    if (!currentSession?.user) {
      return {
        error:
          'Your password reset session has expired. Please request a new reset link.',
      };
    }

    const {
      error,
    } = await supabase.auth.updateUser({
      password,
    });

    return {
      error: error?.message ?? null,
    };
  };

  const signOut = async () => {
    await supabase.auth.signOut();

    setProfile(null);
    setSession(null);
  };

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfile(
        session.user.id
      );
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        role: profile?.role ?? null,
        loading,

        signIn,
        signUp,
        signInWithGoogle,
        resetPassword,
        updatePassword,

        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return ctx;
}
