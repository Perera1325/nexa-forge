import { useEffect, useSyncExternalStore } from 'react';

export type RouteName = 'home' | 'studio' | 'docs' | 'notFound';

/** Maps a URL path to a page. Trailing slashes are ignored. */
export function resolveRoute(pathname: string): RouteName {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return 'home';
  if (path === '/studio') return 'studio';
  if (path === '/docs') return 'docs';
  return 'notFound';
}

const subscribe = (callback: () => void) => {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
};

export function useRoute(): RouteName {
  const path = useSyncExternalStore(subscribe, () => window.location.pathname);
  return resolveRoute(path);
}

/** Sets the document title for the current page. */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

export function navigate(href: string) {
  window.history.pushState(null, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
  const hash = href.split('#')[1];
  const target = hash ? document.getElementById(hash) : null;
  if (target) target.scrollIntoView();
  else document.querySelector('.site')?.scrollTo(0, 0);
}
