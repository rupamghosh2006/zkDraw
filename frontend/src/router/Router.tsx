import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

export interface RouterContextType {
  path: string;
  search: string;
  searchParams: URLSearchParams;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  params: Record<string, string>;
}

const RouterContext = createContext<RouterContextType | null>(null);

function getCleanPath(): { path: string; search: string } {
  if (typeof window === 'undefined') return { path: '/draws', search: '' };

  let rawPath = window.location.pathname;

  // Support hash routing fallback if running in environments without URL rewrites
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    const hashWithoutHash = window.location.hash.slice(1); // e.g. "/draws/123?foo=bar"
    const [hPath, hSearch] = hashWithoutHash.split('?');
    return {
      path: normalizePath(hPath || '/draws'),
      search: hSearch ? `?${hSearch}` : '',
    };
  }

  return {
    path: normalizePath(rawPath || '/draws'),
    search: window.location.search || '',
  };
}

function normalizePath(p: string): string {
  if (!p) return '/draws';
  const trimmed = p.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function matchRoute(
  pattern: string,
  pathname: string,
): { matches: boolean; params: Record<string, string> } {
  const normPattern = normalizePath(pattern);
  const normPath = normalizePath(pathname);

  // Root redirect/match
  if (normPattern === '/' && normPath === '/') {
    return { matches: true, params: {} };
  }

  const patternSegments = normPattern.split('/').filter(Boolean);
  const pathSegments = normPath.split('/').filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return { matches: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternSegments.length; i++) {
    const pSeg = patternSegments[i];
    const aSeg = pathSegments[i];

    if (pSeg.startsWith(':')) {
      const paramName = pSeg.slice(1);
      params[paramName] = decodeURIComponent(aSeg);
    } else if (pSeg.toLowerCase() !== aSeg.toLowerCase()) {
      return { matches: false, params: {} };
    }
  }

  return { matches: true, params };
}

export interface RouterProviderProps {
  children: ReactNode;
}

const NAVIGATE_EVENT = 'zkdraw_navigate';

export const RouterProvider: React.FC<RouterProviderProps> = ({ children }) => {
  const [locationState, setLocationState] = useState(() => getCleanPath());

  const handleLocationChange = useCallback(() => {
    setLocationState(getCleanPath());
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener(NAVIGATE_EVENT, handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener(NAVIGATE_EVENT, handleLocationChange);
    };
  }, [handleLocationChange]);

  const navigate = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      if (typeof window === 'undefined') return;

      const [targetPath, targetSearch] = to.split('?');
      const normalized = normalizePath(targetPath);
      const fullUrl = targetSearch ? `${normalized}?${targetSearch}` : normalized;

      if (options?.replace) {
        window.history.replaceState(null, '', fullUrl);
      } else {
        window.history.pushState(null, '', fullUrl);
      }

      window.dispatchEvent(new Event(NAVIGATE_EVENT));
      // Scroll to top on route change
      window.scrollTo({ top: 0, behavior: 'instant' });
    },
    [],
  );

  const searchParams = useMemo(() => {
    return new URLSearchParams(locationState.search);
  }, [locationState.search]);

  // Extract params if current path is e.g. /draws/:id
  const params = useMemo(() => {
    const drawsMatch = matchRoute('/draws/:id', locationState.path);
    if (drawsMatch.matches) return drawsMatch.params;
    const verifyMatch = matchRoute('/verify/:id', locationState.path);
    if (verifyMatch.matches) return verifyMatch.params;
    return {};
  }, [locationState.path]);

  const value = useMemo(
    () => ({
      path: locationState.path,
      search: locationState.search,
      searchParams,
      navigate,
      params,
    }),
    [locationState.path, locationState.search, searchParams, navigate, params],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export function useRouter(): RouterContextType {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return ctx;
}

export function useNavigate() {
  const { navigate } = useRouter();
  return navigate;
}

export function useLocation() {
  const { path, search, searchParams } = useRouter();
  return { pathname: path, search, searchParams };
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  const { params } = useRouter();
  return params as T;
}

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  replace?: boolean;
}

export const Link: React.FC<LinkProps> = ({
  to,
  replace,
  onClick,
  children,
  ...rest
}) => {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    if (
      !e.defaultPrevented &&
      e.button === 0 && // left click
      !e.metaKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      !e.altKey &&
      !rest.target
    ) {
      e.preventDefault();
      navigate(to, { replace });
    }
  };

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
};
