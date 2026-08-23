import { useState } from 'react';
import { Mail, MessageSquare, ShieldCheck, Send, CheckCircle2 } from 'lucide-react';

export function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-[2rem] bg-[#040720] p-7 text-white shadow-float sm:p-10">
          <span className="section-eyebrow text-white/60">CONTACT QUADRACONVERTER</span>
          <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
            Let’s make document work easier.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/65">
            Questions about conversions, signatures, payments, integrations or enterprise workflows?
            Send us a message and our team can help.
          </p>
          <div className="mt-10 space-y-4">
            <div className="flex gap-4 rounded-2xl bg-white/5 p-4">
              <Mail className="mt-1 h-5 w-5 text-blue-300" />
              <div><b>Email support</b><p className="mt-1 text-sm text-white/55">quadrafroyn@gmail.com</p></div>
            </div>
            <div className="flex gap-4 rounded-2xl bg-white/5 p-4">
              <ShieldCheck className="mt-1 h-5 w-5 text-blue-300" />
              <div><b>Security-first support</b><p className="mt-1 text-sm text-white/55">Never send passwords, private keys or confidential documents in a support message.</p></div>
            </div>
          </div>
        </section>

        <section className="card p-6 sm:p-8">
          {sent ? (
            <div className="grid min-h-[420px] place-items-center text-center">
              <div>
                <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
                <h2 className="mt-5 font-display text-2xl font-extrabold">Message prepared</h2>
                <p className="mt-2 text-sm text-ink-500">Your email client has been opened with the message details.</p>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const subject = String(data.get('subject') || 'QuadraConverter Support');
                const body = `Name: ${data.get('name')}\nEmail: ${data.get('email')}\n\n${data.get('message')}`;
                window.location.href = `mailto:quadrafroyn@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                setSent(true);
              }}
              className="space-y-5"
            >
              <div><h2 className="font-display text-2xl font-extrabold">Send a message</h2><p className="mt-1 text-sm text-ink-500">We’ll help you find the quickest solution.</p></div>
              <label className="block text-sm font-bold">Name<input required name="name" className="input mt-1.5" placeholder="Your name" /></label>
              <label className="block text-sm font-bold">Email<input required type="email" name="email" className="input mt-1.5" placeholder="you@example.com" /></label>
              <label className="block text-sm font-bold">Subject<input required name="subject" className="input mt-1.5" placeholder="How can we help?" /></label>
              <label className="block text-sm font-bold">Message<textarea required name="message" rows={7} className="input mt-1.5 resize-y" placeholder="Tell us what happened..." /></label>
              <button className="btn-primary w-full py-3.5"><Send className="h-4 w-4" /> Open email</button>
              <p className="flex items-center gap-2 text-xs text-ink-400"><MessageSquare className="h-3.5 w-3.5" /> Do not include passwords, payment credentials or private signing keys.</p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
