import { categories } from '@/data/tools';
import { Instagram, Linkedin, Globe, Mail } from 'lucide-react';

type Props = { navigate: (path: string) => void };

export function Footer({ navigate }: Props) {
  return (
    <footer className="border-t border-ink-200 bg-ink-50/60">
      <div className="container-page py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="QuadraConverter" className="h-9 w-9 rounded-xl shadow-soft" />
              <div className="leading-none"><span className="font-display text-[17px] font-extrabold tracking-tight text-ink-900">Quadra<span className="text-brand-600">Converter</span></span><span className="ml-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 ring-1 ring-brand-100">AI</span></div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-500">
              QuadraConverter AI is an all-in-one AI document, image, and file conversion platform with 50+ smart tools — convert anything, enhance everything.
            </p>
            <div className="mt-5 flex items-center gap-2">
  {/* Instagram */}
  <a
    href="https://www.instagram.com/quadrafroyn_/"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Instagram"
    className="grid h-9 w-9 place-items-center rounded-lg bg-white text-ink-500 ring-1 ring-ink-200 transition hover:text-brand-600 hover:ring-brand-200"
  >
    <Instagram className="h-4 w-4" />
  </a>

  {/* LinkedIn */}
  <a
    href="https://www.linkedin.com/company/quadrafroynsolutions/"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="LinkedIn"
    className="grid h-9 w-9 place-items-center rounded-lg bg-white text-ink-500 ring-1 ring-ink-200 transition hover:text-brand-600 hover:ring-brand-200"
  >
    <Linkedin className="h-4 w-4" />
  </a>

  {/* GitHub */}
  {/* Company Portfolio / Website */}
<a
  href="https://quadrafroynsolutions.in"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="QuadraFroyn Solutions Website"
  title="QuadraFroyn Solutions"
  className="grid h-9 w-9 place-items-center rounded-lg bg-white text-ink-500 ring-1 ring-ink-200 transition hover:text-brand-600 hover:ring-brand-200"
>
  <Globe className="h-4 w-4" />
</a>

  {/* Email */}
  <a
    href="mailto:quadrafroyn@gmail.com"
    aria-label="Email"
    className="grid h-9 w-9 place-items-center rounded-lg bg-white text-ink-500 ring-1 ring-ink-200 transition hover:text-brand-600 hover:ring-brand-200"
  >
    <Mail className="h-4 w-4" />
  </a>
</div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400">Product</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><button onClick={() => navigate('/tools')} className="text-ink-600 hover:text-brand-600">All Tools</button></li>
              <li><button onClick={() => navigate('/ai/chat-pdf')} className="text-ink-600 hover:text-brand-600">AI Features</button></li>
              <li><button onClick={() => navigate('/dashboard')} className="text-ink-600 hover:text-brand-600">Dashboard</button></li>
              <li><button onClick={() => navigate('/pricing')} className="text-ink-600 hover:text-brand-600">Pricing</button></li>
              <li><button onClick={() => navigate('/features')} className="text-ink-600 hover:text-brand-600">Features</button></li>
              <li><button onClick={() => navigate('/about')} className="text-ink-600 hover:text-brand-600">About us</button></li>
              <li><button onClick={() => navigate('/security')} className="text-ink-600 hover:text-brand-600">Security</button></li>
              <li><button onClick={() => navigate('/signatures')} className="text-ink-600 hover:text-brand-600">Signatures</button></li>
              <li><button onClick={() => navigate('/admin')} className="text-ink-600 hover:text-brand-600">Admin</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400">Categories</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {categories.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <button onClick={() => navigate(`/tools/${c.id}`)} className="text-ink-600 hover:text-brand-600">{c.name}</button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400">Company</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><button onClick={() => navigate('/about')} className="text-ink-600 hover:text-brand-600">About</button></li>
              <li><button onClick={() => navigate('/contact')} className="text-ink-600 hover:text-brand-600">Contact</button></li>
              <li><span className="text-ink-600">Blog</span></li>
              <li><span className="text-ink-600">Support</span></li>
              <li><span className="text-ink-600">Privacy</span></li>
              <li><span className="text-ink-600">Terms</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-ink-200 pt-6 sm:flex-row">
          <p className="text-xs text-ink-400">© 2026 QuadraConverter AI. All rights reserved.</p>
          <p className="text-xs text-ink-400">Powered By QuadraFroyn Solutions</p>
        </div>
      </div>
    </footer>
  );
}
