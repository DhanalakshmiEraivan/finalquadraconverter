import {
  useEffect,
  useState,
  useCallback,
} from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'auth' }
  | { name: 'tools'; category?: string }
  | { name: 'tool'; id: string }
  | { name: 'ai'; id: string }
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
  /*
   * Supabase recovery links can arrive with:
   *
   * ?reset=1
   *
   * or:
   *
   * #access_token=...&type=recovery
   *
   * or:
   *
   * #/reset-password
   */
  const searchParams =
    new URLSearchParams(
      window.location.search
    );

  const hash =
    window.location.hash;

  const isRecovery =
    searchParams.get('reset') === '1' ||
    searchParams.get('type') === 'recovery' ||
    hash.includes('type=recovery');

  if (isRecovery) {
    return {
      name: 'reset-password',
    };
  }

  const cleanHash =
    hash.replace(/^#\/?/, '');

  const parts =
    cleanHash
      .split('/')
      .filter(Boolean);

  if (parts.length === 0) {
    return {
      name: 'home',
    };
  }

  switch (parts[0]) {
    case 'auth':
      return {
        name: 'auth',
      };

    case 'tools':
      if (
        parts[1] === 'signatures'
      ) {
        return {
          name: 'signatures',
        };
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
      return {
        name: 'dashboard',
      };

    case 'pricing':
      return {
        name: 'pricing',
      };

    case 'ai':
  return {
    name: 'ai',
    id: parts[1] ?? '',
  };

    case 'admin':
      return {
        name: 'admin',
      };

    case 'features':
      return {
        name: 'features',
      };

    case 'about':
      return {
        name: 'about',
      };

    case 'contact':
      return {
        name: 'contact',
      };

    case 'security':
      return {
        name: 'security',
      };

    case 'signatures':
      return {
        name: 'signatures',
      };

    case 'sign':
      return {
        name: 'sign',
        token: decodeURIComponent(
          parts[1] ?? ''
        ),
      };

    case 'reset-password':
      return {
        name: 'reset-password',
      };

    default:
      return {
        name: 'home',
      };
  }
}

export function useRouter() {
  const [route, setRoute] =
    useState<Route>(() =>
      parseHash()
    );

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());

      window.scrollTo({
        top: 0,
        behavior:
          'instant' as ScrollBehavior,
      });
    };

    /*
     * Supabase recovery redirects can
     * change the URL without a normal
     * application navigation.
     */
    window.addEventListener(
      'hashchange',
      onChange
    );

    window.addEventListener(
      'popstate',
      onChange
    );

    return () => {
      window.removeEventListener(
        'hashchange',
        onChange
      );

      window.removeEventListener(
        'popstate',
        onChange
      );
    };
  }, []);

  const navigate = useCallback(
    (path: string) => {
      const clean =
        path.startsWith('#')
          ? path
          : `#${path.startsWith('/')
              ? path
              : `/${path}`}`;

      if (
        window.location.hash === clean
      ) {
        setRoute(parseHash());

        window.scrollTo({
          top: 0,
          behavior:
            'instant' as ScrollBehavior,
        });

        return;
      }

      window.location.hash =
        clean;
    },
    []
  );

  return {
    route,
    navigate,
  };
}
