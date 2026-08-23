import { useEffect, useRef, useState } from 'react';
import {
  Search, Menu, X, Sparkles, ChevronDown, LogOut, LayoutDashboard,
  Shield, User as UserIcon, ArrowUpRight, FileSignature,
} from 'lucide-react';
import { tools, categories } from '@/data/tools';
import type { Route } from '@/router';
import { useAuth } from '@/lib/auth';
import * as Icons from 'lucide-react';

type Props = { route: Route; navigate: (path: string) => void };

export function Header({ route, navigate }: Props) {
  const { user, profile, role, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const categoryTimer = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocus(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenu(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => () => {
    if (categoryTimer.current) window.clearTimeout(categoryTimer.current);
  }, []);

  const results = search.trim()
    ? tools.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 7)
    : [];

  const navItems = user
    ? [
        { label: 'Tools', path: '/tools' },
        { label: 'Signatures', path: '/signatures' },
        { label: 'Features', path: '/features' },
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Pricing', path: '/pricing' },
        ...(role === 'admin' ? [{ label: 'Admin', path: '/admin' }] : []),
      ]
    : [{ label: 'Tools', path: '/tools' },
        { label: 'Signatures', path: '/signatures' },
        { label: 'Features', path: '/features' }, { label: 'Pricing', path: '/pricing' }];

  const isActive = (path: string) => {
    if (path === '/tools') return route.name === 'tools' || route.name === 'tool';
    return route.name === path.slice(1);
  };

  const getIcon = (name: string, className = 'h-4 w-4') => {
    const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
    return Icon ? <Icon className={className} /> : <Icons.FileText className={className} />;
  };

  const openCat = (id: string) => {
    if (categoryTimer.current) window.clearTimeout(categoryTimer.current);
    setOpenCategory(id);
  };

  const closeCatsSoon = () => {
    categoryTimer.current = window.setTimeout(() => setOpenCategory(null), 120);
  };

  const goTool = (id: string) => {
    setOpenCategory(null);
    setMobileOpen(false);
    navigate(`/tool/${id}`);
  };

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/92 backdrop-blur-2xl shadow-soft ring-1 ring-ink-200/70' : 'bg-white/65 backdrop-blur-xl'
    }`}>
      <div className="container-page">
        <div className="flex h-16 items-center justify-between gap-4">
          <button onClick={() => navigate('/')} className="shrink-0" aria-label="QuadraConverter home">
            <span className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="QuadraConverter" className="h-9 w-9 rounded-xl shadow-soft" />
              <span className="hidden sm:block font-display text-[17px] font-extrabold tracking-tight text-ink-900">
                Quadra<span className="text-brand-600">Converter</span>
              </span>
              <span className="hidden sm:inline rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 ring-1 ring-brand-100">AI</span>
            </span>
          </button>

          <div ref={searchRef} className="relative hidden flex-1 max-w-lg md:block">
            <div className={`relative transition-transform duration-200 ${searchFocus ? 'scale-[1.01]' : ''}`}>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocus(true)}
                placeholder={`Search ${tools.length}+ tools…`}
                className="w-full rounded-xl bg-ink-50/90 py-2.5 pl-10 pr-4 text-sm text-ink-900 ring-1 ring-transparent placeholder:text-ink-400 transition focus:bg-white focus:outline-none focus:ring-brand-500/40"
              />
            </div>
            {searchFocus && results.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl bg-white py-2 shadow-float ring-1 ring-ink-200 animate-scale-in">
                {results.map((t) => (
                  <button key={t.id} onClick={() => { goTool(t.id); setSearch(''); setSearchFocus(false); }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-ink-50">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600">{getIcon(t.icon)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-900">{t.name}</span>
                      <span className="block truncate text-xs text-ink-500">{t.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${isActive(item.path) ? 'text-brand-700 bg-brand-50/70' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'}`}>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <div ref={userRef} className="relative">
                <button onClick={() => setUserMenu(!userMenu)}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 ring-1 ring-ink-200 hover:bg-ink-50 transition">
                  <div className="w-8 h-8 rounded-lg bg-ink-900 text-white grid place-items-center text-sm font-bold">
                    {(profile?.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-ink-500" />
                </button>
                {userMenu && (
                  <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-white py-2 shadow-float ring-1 ring-ink-200 animate-scale-in">
                    <div className="px-4 py-3 border-b border-ink-100">
                      <div className="text-sm font-semibold text-ink-900 truncate">{profile?.full_name || 'User'}</div>
                      <div className="text-xs text-ink-500 truncate">{user.email}</div>
                      <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
                        {role === 'admin' ? <><Shield className="w-3 h-3" /> Admin</> : <><UserIcon className="w-3 h-3" /> User</>}
                      </div>
                    </div>
                    <button onClick={() => { navigate('/dashboard'); setUserMenu(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50"><LayoutDashboard className="w-4 h-4" /> Dashboard</button>
                    {role === 'admin' && <button onClick={() => { navigate('/admin'); setUserMenu(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50"><Shield className="w-4 h-4" /> Admin Panel</button>}
                    <button onClick={() => { signOut(); navigate('/'); setUserMenu(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-err-600 hover:bg-err-50"><LogOut className="w-4 h-4" /> Sign Out</button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => navigate('/auth')} className="btn-primary"><Sparkles className="h-4 w-4" /> Sign In</button>
            )}
            <button onClick={() => setMobileOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl ring-1 ring-ink-200 text-ink-700 lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          </div>
        </div>

        {/* Fast category command bar — directly below the main navbar */}
        <div className="hidden lg:flex h-11 items-center gap-1 overflow-visible border-t border-ink-200/50">
          <span className="mr-2 whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400">Explore</span>
          {categories.map((cat) => {
            const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[cat.icon] || Icons.FileText;
            const count = cat.id === 'signatures' ? 16 : tools.filter(t => t.category === cat.id).length;
            const active = openCategory === cat.id;
            return (
              <div key={cat.id} className="relative h-full" onMouseEnter={() => openCat(cat.id)} onMouseLeave={closeCatsSoon}>
                <button onClick={() => navigate(cat.id === 'signatures' ? '/signatures' : `/tools/${cat.id}`)}
                  className={`flex h-full items-center gap-1.5 whitespace-nowrap rounded-t-lg px-2.5 text-[11px] font-bold transition-all ${active ? 'bg-white text-brand-700 shadow-[0_-1px_0_rgba(31,90,240,.12)]' : 'text-ink-500 hover:text-ink-900 hover:bg-white/70'}`}>
                  <Icon className="h-3.5 w-3.5" /> {cat.name.replace(' Tools','').replace(' & Barcode','')}
                  <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-extrabold text-ink-500">{count}</span>
                </button>

                {active && (
                  <div
  onMouseEnter={() => openCat(cat.id)}
  onMouseLeave={closeCatsSoon}
  className="fixed left-1/2 top-[7.35rem] z-[60] w-[min(1180px,calc(100vw-28px))] -translate-x-1/2 overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_rgba(10,28,70,.18)] ring-1 ring-ink-200 animate-mega-menu"
>
                    <div className="grid max-h-[min(620px,calc(100vh-130px))] grid-cols-[230px_1fr]">
                      <div className="relative overflow-hidden bg-ink-950 p-6 text-white">
                        <div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-brand-500/30 blur-3xl" />
                        <Icon className="relative h-8 w-8 text-white" />
                        <h3 className="relative mt-5 font-display text-xl font-extrabold">{cat.name}</h3>
                        <p className="relative mt-2 text-xs leading-relaxed text-white/65">{cat.description}</p>
                        <button onClick={() => { setOpenCategory(null); navigate(cat.id === 'signatures' ? '/signatures' : `/tools/${cat.id}`); }}
                          className="relative mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-ink-900 hover:bg-brand-50">
                          View all {count} <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="scroll-soft overflow-y-auto p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <div><p className="text-xs font-bold uppercase tracking-widest text-brand-600">All tools</p><p className="text-[11px] text-ink-400">Choose a tool to open its workspace instantly</p></div>
                          <kbd className="hidden rounded-md bg-ink-50 px-2 py-1 text-[9px] font-bold text-ink-400 sm:block">HOVER → SELECT</kbd>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                          {cat.id === 'signatures' ? (
                            <button onClick={() => { setOpenCategory(null); navigate('/signatures'); }}
                              className="group col-span-2 flex min-h-[110px] items-start gap-3 rounded-2xl bg-ink-950 p-4 text-left text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-brand-700 sm:col-span-3">
                              <FileSignature className="mt-1 h-6 w-6 shrink-0" />
                              <span><span className="block text-sm font-extrabold">Open Signatures</span><span className="mt-1 block text-xs leading-relaxed text-white/70">16 tools for typed, drawn, uploaded, PDF, image, multi-page and cryptographic signing.</span><span className="mt-3 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold">16 tools · 5 daily credits</span></span>
                            </button>
                          ) : tools.filter(t => t.category === cat.id).map((tool) => (
                            <button key={tool.id} onClick={() => goTool(tool.id)}
                              className="group flex min-h-[76px] items-start gap-2.5 rounded-2xl p-3 text-left ring-1 ring-ink-100 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-50 hover:ring-brand-200 hover:shadow-soft">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-50 text-ink-600 transition group-hover:bg-white group-hover:text-brand-600">{getIcon(tool.icon, 'h-4 w-4')}</span>
                              <span className="min-w-0"><span className="block text-xs font-bold text-ink-900 line-clamp-2">{tool.name}</span><span className="mt-1 block text-[10px] leading-snug text-ink-400 line-clamp-2">{tool.description}</span></span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[min(380px,88vw)] overflow-y-auto bg-white p-5 shadow-float animate-fade-up">
            <div className="flex items-center justify-between"><span className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="QuadraConverter" className="h-9 w-9 rounded-xl shadow-soft" />
              <span className="hidden sm:block font-display text-[17px] font-extrabold tracking-tight text-ink-900">
                Quadra<span className="text-brand-600">Converter</span>
              </span>
              <span className="hidden sm:inline rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 ring-1 ring-brand-100">AI</span>
            </span><button onClick={() => setMobileOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg ring-1 ring-ink-200"><X className="h-4 w-4" /></button></div>
            <div ref={searchRef} className="relative mt-5"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tools…" className="input pl-9" /></div>
            {search && results.length > 0 && <div className="mt-2 space-y-1">{results.map(t => <button key={t.id} onClick={() => { goTool(t.id); setSearch(''); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-ink-50"><span className="text-brand-600">{getIcon(t.icon)}</span><span className="text-sm font-medium">{t.name}</span></button>)}</div>}
            <nav className="mt-5 space-y-1">{navItems.map(item => <button key={item.path} onClick={() => { navigate(item.path); setMobileOpen(false); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-ink-700 hover:bg-ink-100">{item.label}</button>)}{user && <button onClick={() => { signOut(); navigate('/'); setMobileOpen(false); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-err-600 hover:bg-err-50">Sign Out</button>}</nav>
            <div className="mt-5"><p className="px-3 text-xs font-extrabold uppercase tracking-wider text-ink-400">All categories</p><div className="mt-2 space-y-1">{categories.map(c => <div key={c.id}><button onClick={() => navigate(c.id === 'signatures' ? '/signatures' : `/tools/${c.id}`)} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold text-ink-700 hover:bg-brand-50"><span className="flex items-center gap-2">{getIcon(c.icon)} {c.name}</span><span className="text-xs text-ink-400">{c.id === 'signatures' ? 16 : tools.filter(t => t.category === c.id).length}</span></button></div>)}</div></div>
          </div>
        </div>
      )}
    </header>
  );
}
