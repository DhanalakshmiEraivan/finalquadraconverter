import { useEffect, useState } from 'react';
import {
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

import { useAuth } from '@/lib/auth';

export function ResetPasswordPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { session, updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCheckingSession(false);
    }, 800);

    return () => window.clearTimeout(timer);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');

    if (!session?.user) {
      setError(
        'Your password reset session is invalid or has expired. Please request a new reset link.'
      );
      return;
    }

    if (password.length < 6) {
      setError(
        'Password must contain at least 6 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const result = await updatePassword(password);

      if (result.error) {
        setError(result.error);
        return;
      }

      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-700" />

          <p className="text-sm text-ink-500">
            Verifying secure reset session…
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-float ring-1 ring-ink-100 text-center">

          <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto" />

          <h1 className="text-2xl font-bold mt-5">
            Password updated
          </h1>

          <p className="text-ink-500 mt-2">
            Your QuadraConverter password has been changed
            successfully.
          </p>

          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="btn-primary mt-7 w-full py-3.5"
          >
            Continue to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-float ring-1 ring-ink-100">

          <div className="flex justify-center">
            <AlertCircle className="w-14 h-14 text-red-500" />
          </div>

          <h1 className="text-2xl font-bold text-center mt-5">
            Reset link expired
          </h1>

          <p className="text-sm text-ink-500 text-center mt-2">
            This password reset session is invalid or has expired.
            Please request a new password reset link.
          </p>

          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="btn-primary mt-7 w-full py-3.5"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">

      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-float ring-1 ring-ink-100">

        <div className="flex justify-center mb-6">
          <img
            src="/logo.svg"
            alt="QuadraConverter"
            className="h-14 w-14 rounded-2xl shadow-soft"
          />
        </div>

        <h1 className="text-2xl font-bold text-center">
          Create a new password
        </h1>

        <p className="text-sm text-ink-500 text-center mt-2 mb-7">
          Enter your new password and confirm it below.
        </p>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 text-red-700 text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />

            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={submit}
          className="space-y-5"
        >

          {/* NEW PASSWORD */}
          <div>
            <label className="text-sm font-medium">
              New Password
            </label>

            <div className="relative mt-1.5">

              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-ink-400" />

              <input
                className="input pl-10 pr-11"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                minLength={6}
                required
                autoComplete="new-password"
                placeholder="Enter new password"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((value) => !value)
                }
                className="absolute right-3 top-3.5 text-ink-400 hover:text-ink-700"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <p className="text-xs text-ink-400 mt-1.5">
              Minimum 6 characters.
            </p>
          </div>

          {/* CONFIRM PASSWORD */}
          <div>
            <label className="text-sm font-medium">
              Confirm Password
            </label>

            <div className="relative mt-1.5">

              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-ink-400" />

              <input
                className="input pl-10 pr-11"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                minLength={6}
                required
                autoComplete="new-password"
                placeholder="Confirm new password"
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirm((value) => !value)
                }
                className="absolute right-3 top-3.5 text-ink-400 hover:text-ink-700"
              >
                {showConfirm ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Updating password…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Confirm Password
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
