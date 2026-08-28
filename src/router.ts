import { useCallback, useEffect, useState } from 'react';
import { getToolById, tools } from '@/data/tools';

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

function parsePath(): Route {
  const searchParams = new URLSearchParams(window.location.search);

  if (
    searchParams.get('reset') === '1' ||
    window.location.hash.includes('type=recovery')
  ) {
    return { name: 'reset-password' };
  }

  /*
   * Backward compatibility for old hash URLs.
   *
   * Example:
   * #/tool/pdf-to-jpg
   * #/tools/pdf
   */
  const hash = window.location.hash.replace(/^#\/?/, '');

  if (hash) {
    const parts = hash.split('/').filter(Boolean);

    if (parts.length > 0) {
      switch (parts[0]) {
        case 'auth':
          return { name: 'auth' };

        case 'tools':
          if (parts[1] === 'signatures') {
            return { name: 'signatures' };
          }

          return {
            name: 'tools',
            category: parts[1],
          };

        case 'tool':
          return {
            name: 'tool',
            id: parts[1] ?? '',
          };

        case 'dashboard':
          return { name: 'dashboard' };

        case 'pricing':
          return { name: 'pricing' };

        case 'ai':
          return { name: 'tools' };

        case 'admin':
          return { name: 'admin' };

        case 'features':
          return { name: 'features' };

        case 'about':
          return { name: 'about' };

        case 'contact':
          return { name: 'contact' };

        case 'security':
          return { name: 'security' };

        case 'signatures':
          return { name: 'signatures' };

        case 'sign':
          return {
            name: 'sign',
            token: decodeURIComponent(parts[1] ?? ''),
          };

        case 'reset-password':
          return { name: 'reset-password' };

        default:
          break;
      }
    }
  }

  /*
   * REAL SEO URL ROUTING
   */

  const pathname = window.location.pathname
    .replace(/^\/+|\/+$/g, '');

  if (!pathname) {
    return { name: 'home' };
  }

  const parts = pathname.split('/').filter(Boolean);

  /*
   * Public pages
   */

  switch (parts[0]) {
    case 'auth':
      return { name: 'auth' };

    case 'tools':
      if (parts[1] === 'signatures') {
        return { name: 'signatures' };
      }

      return {
        name: 'tools',
        category: parts[1],
      };

    case 'dashboard':
      return { name: 'dashboard' };

    case 'pricing':
      return { name: 'pricing' };

    case 'features':
      return { name: 'features' };

    case 'about':
      return { name: 'about' };

    case 'contact':
      return { name: 'contact' };

    case 'security':
      return { name: 'security' };

    case 'signatures':
      return { name: 'signatures' };

    case 'admin':
      return { name: 'admin' };

    case 'sign':
      return {
        name: 'sign',
        token: decodeURIComponent(parts[1] ?? ''),
      };

    case 'reset-password':
      return { name: 'reset-password' };

    default:
      break;
  }

  /*
   * REAL TOOL SEO URL
   *
   * Example:
   * /pdf-to-jpg
   * /pdf-to-word
   * /img-compress
   * /qr-generate
   */

  const tool = getToolById(parts[0]);

  if (tool) {
    return {
      name: 'tool',
      id: tool.id,
    };
  }

  /*
   * Unknown URL
   */
  return { name: 'home' };
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parsePath());

  useEffect(() => {
    const onChange = () => {
      setRoute(parsePath());

      window.scrollTo({
        top: 0,
        behavior: 'instant' as ScrollBehavior,
      });
    };

    window.addEventListener('popstate', onChange);
    window.addEventListener('hashchange', onChange);

    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('hashchange', onChange);
    };
  }, []);

  const navigate = useCallback((path: string) => {
    let cleanPath = path;

    /*
     * Convert old hash navigation:
     *
     * #/tool/pdf-to-jpg
     *
     * into:
     *
     * /pdf-to-jpg
     */

    if (cleanPath.startsWith('#')) {
      cleanPath = cleanPath.replace(/^#\/?/, '/');

      if (cleanPath.startsWith('/tool/')) {
        cleanPath = cleanPath.replace('/tool/', '/');
      }
    }

    if (!cleanPath.startsWith('/')) {
      cleanPath = `/${cleanPath}`;
    }

    /*
     * Keep old category URLs working.
     */
    if (cleanPath === '/tools') {
      cleanPath = '/tools';
    }

    if (window.location.pathname !== cleanPath) {
      window.history.pushState({}, '', cleanPath);
      setRoute(parsePath());

      window.scrollTo({
        top: 0,
        behavior: 'instant' as ScrollBehavior,
      });
    } else {
      setRoute(parsePath());
    }
  }, []);

  return {
    route,
    navigate,
  };
}
