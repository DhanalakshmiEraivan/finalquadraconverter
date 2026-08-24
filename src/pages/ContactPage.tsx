import { useState } from 'react';
import {
  Mail,
  MessageSquare,
  ShieldCheck,
  Send,
  CheckCircle2,
} from 'lucide-react';

export function ContactPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSent(true);
        form.reset();
      } else {
        alert('Something went wrong. Please try again.');
      }
    } catch (error) {
      console.error(error);
      alert('Unable to send your message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr]">

        {/* LEFT SIDE */}
        <section className="rounded-[2rem] bg-[#040720] p-7 text-white shadow-float sm:p-10">
          <span className="section-eyebrow text-white/60">
            CONTACT QUADRACONVERTER
          </span>

          <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
            Let’s make document work easier.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-white/65">
            Questions about conversions, signatures, payments, integrations
            or enterprise workflows? Send us a message and our team can help.
          </p>

          <div className="mt-10 space-y-4">

            {/* EMAIL */}
            <div className="flex gap-4 rounded-2xl bg-white/5 p-4">
              <Mail className="mt-1 h-5 w-5 text-blue-300" />

              <div>
                <b>Email support</b>

                <p className="mt-1 text-sm text-white/55">
                  quadrafroyn@gmail.com
                </p>
              </div>
            </div>

            {/* SECURITY */}
            <div className="flex gap-4 rounded-2xl bg-white/5 p-4">
              <ShieldCheck className="mt-1 h-5 w-5 text-blue-300" />

              <div>
                <b>Security-first support</b>

                <p className="mt-1 text-sm text-white/55">
                  Never send passwords, private keys or confidential documents
                  in a support message.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* RIGHT SIDE */}
        <section className="card p-6 sm:p-8">

          {sent ? (
            /* SUCCESS MESSAGE */
            <div className="grid min-h-[420px] place-items-center text-center">
              <div>
                <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />

                <h2 className="mt-5 font-display text-2xl font-extrabold">
                  Message sent successfully!
                </h2>

                <p className="mt-2 text-sm text-ink-500">
                  Thank you for contacting QuadraConverter. Our team will
                  get back to you soon.
                </p>

                <button
                  onClick={() => setSent(false)}
                  className="btn-primary mt-6 px-6 py-3"
                >
                  Send another message
                </button>
              </div>
            </div>
          ) : (

            /* CONTACT FORM */
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              <div>
                <h2 className="font-display text-2xl font-extrabold">
                  Send a message
                </h2>

                <p className="mt-1 text-sm text-ink-500">
                  We’ll help you find the quickest solution.
                </p>
              </div>

              {/* WEB3FORMS ACCESS KEY */}
              <input
                type="hidden"
                name="access_key"
                value="ec361dc1-ffba-401b-8899-d74d3f16cca2"
              />

              {/* EMAIL SUBJECT */}
              <input
                type="hidden"
                name="subject"
                value="New QuadraConverter Contact Message"
              />

              {/* FROM NAME */}
              <input
                type="hidden"
                name="from_name"
                value="QuadraConverter Website"
              />

              {/* NAME */}
              <label className="block text-sm font-bold">
                Name

                <input
                  required
                  type="text"
                  name="name"
                  className="input mt-1.5"
                  placeholder="Your name"
                />
              </label>

              {/* EMAIL */}
              <label className="block text-sm font-bold">
                Email

                <input
                  required
                  type="email"
                  name="email"
                  className="input mt-1.5"
                  placeholder="you@example.com"
                />
              </label>

              {/* SUBJECT */}
              <label className="block text-sm font-bold">
                Subject

                <input
                  required
                  type="text"
                  name="message_subject"
                  className="input mt-1.5"
                  placeholder="How can we help?"
                />
              </label>

              {/* MESSAGE */}
              <label className="block text-sm font-bold">
                Message

                <textarea
                  required
                  name="message"
                  rows={7}
                  className="input mt-1.5 resize-y"
                  placeholder="Tell us what happened..."
                />
              </label>

              {/* SUBMIT */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />

                {loading ? 'Sending...' : 'Send Message'}
              </button>

              {/* SECURITY NOTE */}
              <p className="flex items-center gap-2 text-xs text-ink-400">
                <MessageSquare className="h-3.5 w-3.5" />

                Do not include passwords, payment credentials or private
                signing keys.
              </p>

            </form>
          )}

        </section>
      </div>
    </div>
  );
}
