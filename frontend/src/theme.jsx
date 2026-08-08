// Theme provider + responsive context.
//
// - Dark/light persisted in localStorage as `vdx.theme`.
// - Root <div class="vdx"> gets `data-theme="dark"|"light"`. All CSS tokens
//   live in styles.css under those selectors.
// - isMobile is measured with ResizeObserver against the root element (not
//   window.innerWidth), so embedded contexts (iframes) work correctly.

import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

const ThemeCtx = createContext({ theme: 'dark', setTheme: () => {}, isMobile: false });

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeRaw] = useState(() => {
    try { return localStorage.getItem('vdx.theme') || 'dark'; } catch { return 'dark'; }
  });
  const setTheme = (t) => {
    setThemeRaw(t);
    try { localStorage.setItem('vdx.theme', t); } catch {}
  };

  const [isMobile, setMobile] = useState(false);
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setMobile(w < 820);
    });
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, isMobile }}>
      <div
        ref={rootRef}
        className={'vdx ' + (isMobile ? 'is-mobile' : 'has-sidebar')}
        data-theme={theme}
      >
        {children}
      </div>
    </ThemeCtx.Provider>
  );
}
