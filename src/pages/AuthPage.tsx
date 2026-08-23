import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Mail, Lock, User, ArrowRight, AlertCircle, Loader2, ShieldCheck, Zap, Chrome, KeyRound } from 'lucide-react';

export function AuthPage() {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<'signin'|'signup'|'forgot'>('signin');
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [fullName,setFullName]=useState('');
  const [error,setError]=useState<string|null>(null); const [message,setMessage]=useState<string|null>(null); const [loading,setLoading]=useState(false);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault(); setError(null); setMessage(null); setLoading(true);
    const r=mode==='forgot' ? await resetPassword(email) : mode==='signin' ? await signIn(email,password) : await signUp(email,password,fullName||undefined);
    setLoading(false);
    if(r.error) setError(r.error); else if(mode==='forgot') setMessage('If that Gmail address has an account, a password-reset email has been sent. Check Inbox and Spam.');
    else if(mode==='signup') setMessage('Account created. If email confirmation is enabled in Supabase, confirm your email before signing in.');
  };
  const google=async()=>{setError(null);setLoading(true);const r=await signInWithGoogle();if(r.error){setError(r.error);setLoading(false)}};

  return <div className="min-h-screen bg-ink-50 text-ink-900 flex items-center justify-center p-4">
    <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
      <div className="hidden lg:block p-10">
        <div className="flex items-center gap-3"><img src="/logo.svg" alt="QuadraConverter" className="h-11 w-11 rounded-2xl shadow-soft"/><span className="text-2xl font-bold">QuadraConverter</span></div>
        <h1 className="mt-10 text-5xl font-extrabold leading-tight">Fast documents.<br/><span className="text-brand-700">Private by design.</span></h1>
        <p className="mt-5 text-lg text-ink-500 max-w-xl">Professional conversion, e-signatures and document workflows with a clean, secure experience.</p>
        <div className="mt-8 space-y-4">{[
          [Zap,'5 free credits every day','Use the free tools without a subscription.'],
          [ShieldCheck,'Privacy-first workflows','Files are protected and generated outputs are private.'],
          [KeyRound,'Secure account recovery','Google sign-in and real password reset emails.'],
        ].map(([I,t,d])=><div className="flex gap-3" key={String(t)}><div className="h-10 w-10 rounded-xl bg-brand-100 flex items-center justify-center"><I className="h-5 w-5 text-brand-700"/></div><div><b>{String(t)}</b><p className="text-sm text-ink-500">{String(d)}</p></div></div>)}</div>
      </div>
      <div className="bg-white rounded-3xl shadow-float ring-1 ring-ink-100 p-7 sm:p-10">
        <div className="lg:hidden flex justify-center mb-7"><img src="/logo.svg" alt="QuadraConverter" className="h-12 w-12 rounded-2xl shadow-soft"/></div>
        <div className="flex gap-1 p-1 bg-ink-50 rounded-xl mb-6">
          <button onClick={()=>setMode('signin')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold ${mode==='signin'?'bg-white shadow-soft':''}`}>Sign In</button>
          <button onClick={()=>setMode('signup')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold ${mode==='signup'?'bg-white shadow-soft':''}`}>Sign Up</button>
        </div>
        <h2 className="text-2xl font-bold">{mode==='forgot'?'Reset your password':mode==='signin'?'Welcome back':'Create your account'}</h2>
        <p className="mt-1 text-sm text-ink-500">{mode==='forgot'?'Enter your Gmail address and we will email a secure reset link.':'Use Google or your email to access QuadraConverter.'}</p>
        {error&&<div className="mt-5 p-3 rounded-xl bg-red-50 text-red-700 text-sm flex gap-2"><AlertCircle className="w-4 h-4 shrink-0"/><span>{error}</span></div>}
        {error?.toLowerCase().includes('provider is not enabled') && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">Google Sign-In is disabled in your Supabase project.</p>
            <p className="mt-1">Open Supabase → Authentication → Providers → Google, enable Google, add your Google OAuth Client ID/Secret, save it, and add <code className="rounded bg-white px-1.5 py-0.5">http://localhost:5173/</code> to Authentication → URL Configuration.</p>
            <p className="mt-2 text-xs text-amber-800">This is a Supabase provider setting; the browser cannot enable it from the frontend.</p>
          </div>
        )}
        {message&&<div className="mt-5 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">{message}</div>}
        {mode!=='forgot'&&<button onClick={google} disabled={loading} className="w-full mt-6 py-3.5 rounded-xl border border-ink-200 hover:bg-ink-50 font-semibold flex justify-center gap-2"><Chrome className="w-5 h-5"/>{loading?'Connecting…':'Continue with Google'}</button>}
        {mode!=='forgot'&&<div className="my-5 flex items-center gap-3 text-xs text-ink-400"><span className="h-px bg-ink-100 flex-1"/>OR<span className="h-px bg-ink-100 flex-1"/></div>}
        <form onSubmit={submit} className="space-y-4">
          {mode==='signup'&&<div><label className="text-sm font-medium">Full name</label><div className="relative mt-1.5"><User className="absolute left-3 top-3.5 w-4 h-4 text-ink-400"/><input className="input pl-10" value={fullName} onChange={e=>setFullName(e.target.value)} required placeholder="Your name"/></div></div>}
          <div><label className="text-sm font-medium">Gmail / Email</label><div className="relative mt-1.5"><Mail className="absolute left-3 top-3.5 w-4 h-4 text-ink-400"/><input className="input pl-10" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@gmail.com"/></div></div>
          {mode!=='forgot'&&<div><label className="text-sm font-medium">Password</label><div className="relative mt-1.5"><Lock className="absolute left-3 top-3.5 w-4 h-4 text-ink-400"/><input className="input pl-10" type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required placeholder="At least 6 characters"/></div></div>}
          {mode==='signin'&&<div className="text-right"><button type="button" onClick={()=>{setMode('forgot');setError(null);setMessage(null)}} className="text-sm text-brand-700 font-semibold">Forgot password?</button></div>}
          <button disabled={loading} className="btn-primary w-full py-3.5">{loading?<Loader2 className="animate-spin"/>:<>{mode==='forgot'?'Send reset email':mode==='signin'?'Sign In':'Create Account'}<ArrowRight className="w-4 h-4"/></>}</button>
        </form>
        {mode==='forgot'&&<button onClick={()=>setMode('signin')} className="w-full mt-4 text-sm text-ink-500 hover:text-ink-900">Back to sign in</button>}
      </div>
    </div>
  </div>;
}
