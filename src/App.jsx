// Hlavní komponenta: určuje, která obrazovka se ukáže pro kterou adresu,
// a pod ni vždy přidá spodní lištu.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import BottomNav from './components/BottomNav.jsx';
import HelperBanner from './components/HelperBanner.jsx';
import Doctor from './pages/Doctor.jsx';
import AppStatus from './offline/AppStatus.jsx';
import { useLang } from './i18n/index.js';
import { directionForPath, setNavigationDirection } from './navigation.js';

export default function App() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const historyIndexRef = useRef(window.history.state?.idx);
  // Po změně jazyka se překreslí celá appka (všechny texty jdou přes t()).
  useLang();

  useLayoutEffect(() => {
    if (navigationType === 'POP') {
      const savedScrollY = window.history.state?.scrollY;
      window.scrollTo(0, Number.isFinite(savedScrollY) ? savedScrollY : 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, navigationType]);

  useLayoutEffect(() => {
    historyIndexRef.current = window.history.state?.idx;
  }, [location.key]);

  useEffect(() => {
    let frame = 0;
    const saveScrollPosition = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const state = window.history.state;
        if (!state || !Number.isInteger(state.idx)) return;
        window.history.replaceState({ ...state, scrollY: window.scrollY }, '');
      });
    };
    window.addEventListener('scroll', saveScrollPosition, { passive: true });
    return () => {
      window.removeEventListener('scroll', saveScrollPosition);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    let edgeStart = null;
    let edgeSwipeUntil = 0;

    const onTouchStart = (event) => {
      const touch = event.touches[0];
      edgeStart = touch && touch.clientX <= 24 ? { x: touch.clientX, y: touch.clientY } : null;
    };
    const onTouchMove = (event) => {
      if (!edgeStart) return;
      const touch = event.touches[0];
      const deltaX = touch.clientX - edgeStart.x;
      const deltaY = Math.abs(touch.clientY - edgeStart.y);
      if (deltaX > 35 && deltaX > deltaY * 1.2) edgeSwipeUntil = Date.now() + 1200;
    };
    const onTouchEnd = () => {
      edgeStart = null;
    };
    const onPopState = () => {
      const nextIndex = window.history.state?.idx;
      const direction =
        Number.isInteger(historyIndexRef.current) && Number.isInteger(nextIndex)
          ? nextIndex < historyIndexRef.current
            ? 'back'
            : 'forward'
          : 'back';
      historyIndexRef.current = nextIndex;
      setNavigationDirection(direction, Date.now() < edgeSwipeUntil);
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true, capture: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });
    window.addEventListener('popstate', onPopState, true);
    return () => {
      window.removeEventListener('touchstart', onTouchStart, true);
      window.removeEventListener('touchmove', onTouchMove, true);
      window.removeEventListener('touchend', onTouchEnd, true);
      window.removeEventListener('touchcancel', onTouchEnd, true);
      window.removeEventListener('popstate', onPopState, true);
    };
  }, []);

  function handleNavigationClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || anchor.target && anchor.target !== '_self' || anchor.hasAttribute('download')) return;

    const target = new URL(anchor.href, window.location.href);
    if (target.origin !== window.location.origin) return;

    const bottomNav = anchor.closest('.bottom-nav');
    if (bottomNav) {
      const currentTab = bottomNav.querySelector('.nav-item.active');
      const fromIndex = Number(currentTab?.dataset.navIndex);
      const toIndex = Number(anchor.dataset.navIndex);
      if (Number.isInteger(fromIndex) && Number.isInteger(toIndex)) {
        setNavigationDirection(toIndex >= fromIndex ? 'forward' : 'back');
      } else {
        const currentPath = currentTab ? new URL(currentTab.href).pathname : location.pathname;
        setNavigationDirection(directionForPath(currentPath, target.pathname));
      }
    } else {
      setNavigationDirection('forward');
    }
  }

  // Lékařský pohled je pro počítač v ordinaci – vlastní rozložení,
  // bez úzkého mobilního rámečku a bez spodní lišty pacienta.
  if (location.pathname.startsWith('/doc')) {
    return (
      <div onClickCapture={handleNavigationClick}>
        <AppStatus doctor />
        <Doctor />
      </div>
    );
  }

  return (
    <div className="app" onClickCapture={handleNavigationClick}>
      {/* Bez internetu / fotky ve frontě / nová verze appky */}
      <AppStatus />
      <main className="page">
        {/* Režim pro blízké: pruh "Vyplňujete za: …" */}
        <HelperBanner />
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
