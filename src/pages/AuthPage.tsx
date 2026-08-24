import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Zap,
  Chrome,
  KeyRound,
} from 'lucide-react';

export function AuthPage() {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const changeMode = (newMode: 'signin' | 'signup' | 'forgot') => {
    setMode(newMode);
    setError(null);
    setMessage(null);
    setPassword('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'forgot') {
        const result = await resetPassword(email.trim());

        if (result.error) {
          setError(result.error);
        } else {
          setMessage(
            'A secure password reset link has been sent to your email. Open the link to create your new password.'
          );
        }

        return;
      }

      if (mode === 'signin') {
        const result = await signIn(email.trim(), password);

        if (result.error) {
          setError(result.error);
        }

        return;
      }

      const result = await signUp(
        email.trim(),
        password,
        fullName.trim() || undefined
      );

      if (result.error) {
        setError(result.error);
      } else {
        setMessage(
          'Account created successfully. If email confirmation is enabled in Supabase, please confirm your email before signing in.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);

    const result = await signInWithGoogle();

    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50 text-ink-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">

        {/* LEFT SIDE */}
        <div className="hidden lg:block p-10">
          <div className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="QuadraConverter"
              className="h-11 w-11 rounded-2xl shadow-soft"
            />

            <span className="text-2xl font-bold">
              QuadraConverter
            </span>
          </div>

          <h1 className="mt-10 text-5xl font-extrabold leading-tight">
            Fast documents.
            <br />
            <span className="text-brand-700">
              Private by design.
            </span>
          </h1>

          <p className="mt-5 text-lg text-ink-500 max-w-xl">
            Professional conversion, e-signatures and document
            workflows with a clean, secure experience.
          </p>

          <div className="mt-8 space-y-4">
            {[
              [
                Zap,
                '5 free credits every day',
                'Use the free tools without a subscription.',
              ],
              [
                ShieldCheck,
                'Privacy-first workflows',
                'Files are protected and generated outputs are private.',
              ],
              [
                KeyRound,
                'Secure account recovery',
                'Your password is protected by Supabase Authentication.',
              ],
            ].map(([I, title, description]) => {
              const Icon = I as typeof Zap;

              return (
                <div
                  className="flex gap-3"
                  key={String(title)}
                >
                  <div className="h-10 w-10 rounded-xl bg-brand-100 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-brand-700" />
                  </div>

                  <div>
                    <b>{String(title)}</b>

                    <p className="text-sm text-ink-500">
                      {String(description)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AUTH CARD */}
        <div className="bg-white rounded-3xl shadow-float ring-1 ring-ink-100 p-7 sm:p-10">

          <div className="lg:hidden flex justify-center mb-7">
            <img
              src="/logo.svg"
              alt="QuadraConverter"
              className="h-12 w-12 rounded-2xl shadow-soft"
            />
          </div>

          {mode !== 'forgot' ? (
            <div className="flex gap-1 p-1 bg-ink-50 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => changeMode('signin')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold ${
                  mode === 'signin'
                    ? 'bg-white shadow-soft'
                    : ''
                }`}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => changeMode('signup')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold ${
                  mode === 'signup'
                    ? 'bg-white shadow-soft'
                    : ''
                }`}
              >
                Sign Up
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => changeMode('signin')}
              className="mb-5 text-sm text-brand-700 font-semibold"
            >
              ← Back to sign in
            </button>
          )}

          <h2 className="text-2xl font-bold">
            {mode === 'forgot'
              ? 'Reset your password'
              : mode === 'signin'
              ? 'Welcome back'
              : 'Create your account'}
          </h2>

          <p className="mt-1 text-sm text-ink-500">
            {mode === 'forgot'
              ? 'Enter the email address associated with your QuadraConverter account.'
              : 'Use Google or your email to access QuadraConverter.'}
          </p>

          {error && (
            <div className="mt-5 p-3 rounded-xl bg-red-50 text-red-700 text-sm flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {error?.toLowerCase().includes('provider is not enabled') && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">
                Google Sign-In is disabled in your Supabase project.
              </p>

              <p className="mt-1">
                Open Supabase → Authentication → Providers → Google,
                enable Google, configure your Google OAuth credentials,
                and save the configuration.
              </p>
            </div>
          )}

          {message && (
            <div className="mt-5 p-4 rounded-xl bg-emerald-50 text-emerald-700 text-sm">
              {message}
            </div>
          )}

          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                onClick={google}
                disabled={loading}
                className="w-full mt-6 py-3.5 rounded-xl border border-ink-200 hover:bg-ink-50 font-semibold flex justify-center gap-2"
              >
                <Chrome className="w-5 h-5" />

                {loading
                  ? 'Connecting…'
                  : 'Continue with Google'}
              </button>

              <div className="my-5 flex items-center gap-3 text-xs text-ink-400">
                <span className="h-px bg-ink-100 flex-1" />
                OR
                <span className="h-px bg-ink-100 flex-1" />
              </div>
            </>
          )}

          <form
            onSubmit={submit}
            className="space-y-4"
          >
            {mode === 'signup' && (
              <div>
                <label className="text-sm font-medium">
                  Full name
                </label>

                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-3.5 w-4 h-4 text-ink-400" />

                  <input
                    className="input pl-10"
                    value={fullName}
                    onChange={(e) =>
                      setFullName(e.target.value)
                    }
                    required
                    placeholder="Your name"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">
                Gmail / Email
              </label>

              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-ink-400" />

                <input
                  className="input pl-10"
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  required
                  autoComplete="email"
                  placeholder="you@gmail.com"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="text-sm font-medium">
                  Password
                </label>

                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-3.5 w-4 h-4 text-ink-400" />

                  <input
                    className="input pl-10"
                    type="password"
                    minLength={6}
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    required
                    autoComplete={
                      mode === 'signup'
                        ? 'new-password'
                        : 'current-password'
                    }
                    placeholder="At least 6 characters"
                  />
                </div>
              </div>
            )}

            {mode === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => changeMode('forgot')}
                  className="text-sm text-brand-700 font-semibold"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  {mode === 'forgot'
                    ? 'Send secure reset link'
                    : mode === 'signin'
                    ? 'Sign In'
                    : 'Create Account'}

                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
