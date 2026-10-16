import { useCallback } from 'react';
import { resolvePath, useLocation, useNavigate } from 'react-router-dom';

const TAB_PATHS = ['/', '/vyfotit', '/leky', '/zprava'];

function tabIndex(pathname) {
  const exactIndex = TAB_PATHS.indexOf(pathname);
  if (exactIndex >= 0) return exactIndex;
  if (pathname.startsWith('/doplnky') || pathname.startsWith('/onkologie')) return 2;
  if (pathname.startsWith('/pin')) return 3;
  if (pathname.startsWith('/nastaveni') || pathname.startsWith('/blizky') || pathname.startsWith('/pomoc')) return 0;
  return -1;
}

export function setNavigationDirection(direction, nativeBackGesture = false) {
  const root = document.documentElement;
  root.dataset.nav = direction;

  if (nativeBackGesture) root.dataset.navNative = 'true';
  else delete root.dataset.navNative;
}

export function directionForPath(from, to) {
  const fromIndex = tabIndex(from);
  const toIndex = tabIndex(to);

  if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
    return toIndex > fromIndex ? 'forward' : 'back';
  }

  return 'forward';
}

export function useAppNavigate() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (to, options = {}) => {
      const { direction, ...routerOptions } = options;

      if (typeof to === 'number') {
        setNavigationDirection(direction ?? (to < 0 ? 'back' : 'forward'));
      } else {
        const targetPath = resolvePath(typeof to === 'string' ? to : to.pathname, location.pathname).pathname;
        setNavigationDirection(direction ?? directionForPath(location.pathname, targetPath));
      }

      navigate(to, { ...routerOptions, viewTransition: true });
    },
    [location.pathname, navigate],
  );
}
