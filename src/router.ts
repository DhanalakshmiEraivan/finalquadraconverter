import { useEffect, useState, useCallback } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'auth' }
  | { name: 'tools'; category?: string }
  | { name: 'tool'; id: string }
  | { name: 'dashboard' }
  | { name: 'pricing' }
  | { name: 'admin' }
  | { name: 'features' }
  | { name: 'about' }
  | { name: 'contact' }
  | { name: 'security' }
  | { name: 'signatures' }
  | { name: 'sign'; token: string }
  | { name: 'reset-password' };

function parseHash(): Route {
  if (new URLSearchParams(window.location.search).get('reset') === '1' || window.location.hash.includes('type=recovery')) return { name: 'reset-password' };
  const hash = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home' };
  switch (parts[0]) {
    case 'auth':
      return { name: 'auth' };
    case 'tools':
      if (parts[1] === 'signatures') return { name: 'signatures' };
      return { name: 'tools', category: parts[1] };
    case 'tool':
      return { name: 'tool', id: parts[1] ?? '' };
    case 'dashboard':
      return { name: 'dashboard' };
    case 'pricing':
      return { name: 'pricing' };
    case 'ai':
      return { name: 'tools' };
    case 'admin': return { name: 'admin' };
    case 'features': return { name: 'features' };
    case 'about': return { name: 'about' };
    case 'contact': return { name: 'contact' };
    case 'security': return { name: 'security' };
    case 'signatures': return { name: 'signatures' };
    case 'sign': return { name: 'sign', token: decodeURIComponent(parts[1] ?? '') };
    case 'reset-password': return { name: 'reset-password' };
    default:
      return { name: 'home' };
  }
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parseHash());

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((path: string) => {
    const clean = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`;
    if (window.location.hash === clean) {
      setRoute(parseHash());
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } else {
      window.location.hash = clean;
    }
  }, []);

  return { route, navigate };
}
