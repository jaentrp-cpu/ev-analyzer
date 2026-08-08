import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from './theme.jsx';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import { MobileTop, BottomNav, MobileDrawer } from './components/MobileNav.jsx';
import AuthModal from './components/AuthModal.jsx';
import PolicyModal from './components/PolicyModal.jsx';
import SiteFooter from './components/SiteFooter.jsx';

import Home from './pages/Home.jsx';
import Value from './pages/Value.jsx';
import Sure from './pages/Sure.jsx';
import MyBets from './pages/MyBets.jsx';
import Guides from './pages/Guides.jsx';
import News from './pages/News.jsx';
import Subscriptions from './pages/Subscriptions.jsx';
import Socials from './pages/Socials.jsx';

const PAGES = { home: Home, value: Value, sure: Sure, mybets: MyBets, guides: Guides, news: News, subscriptions: Subscriptions, socials: Socials };
const PAGE_ALIASES = { analytics: 'mybets' };

function resolvePage(page) {
  const resolved = PAGE_ALIASES[page] || page;
  return PAGES[resolved] ? resolved : 'home';
}

export default function App() {
  const [page, setPage] = useState(() => {
    try {
      const hashPage = window.location.hash?.replace('#', '');
      if (PAGES[hashPage] || PAGE_ALIASES[hashPage]) return resolvePage(hashPage);
      return resolvePage(localStorage.getItem('vdx.page') || 'home');
    } catch { return 'home'; }
  });
  useEffect(() => {
    try {
      localStorage.setItem('vdx.page', page);
      if (window.location.hash !== `#${page}`) {
        window.history.replaceState(null, '', `#${page}`);
      }
    } catch {}
  }, [page]);
  useEffect(() => {
    function onHashChange() {
      const hashPage = window.location.hash?.replace('#', '');
      if (PAGES[hashPage] || PAGE_ALIASES[hashPage]) setPage(resolvePage(hashPage));
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const { isMobile } = useTheme();
  const [drawerMode, setDrawerMode] = useState('closed');
  const closeDrawer = useCallback(() => setDrawerMode('closed'), []);
  const [policy, setPolicy] = useState(null);
  const mainRef = useRef(null);
  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [page]);
  useEffect(() => {
    if (!isMobile) setDrawerMode('closed');
  }, [isMobile]);

  const PageComp = PAGES[page] || (() => <div style={{ padding: 40, color: 'var(--tx3)' }}>Ladataan...</div>);

  return (
    <>
      {!isMobile && <Sidebar page={page} setPage={setPage} onPolicy={setPolicy} />}
      <main
        ref={mainRef}
        style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
          background: 'var(--bg-radial), var(--bg)', overflow: 'auto',
        }}
      >
        {isMobile
          ? (
            <MobileTop
              page={page}
              onMenu={() => setDrawerMode('menu')}
              onProfile={() => setDrawerMode('profile')}
            />
          )
          : <TopBar page={page} />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <PageComp setPage={setPage} />
        </div>
        <SiteFooter onPolicy={setPolicy} />
        {isMobile && (
          <BottomNav
            page={page}
            setPage={setPage}
            openMore={() => setDrawerMode('menu')}
          />
        )}
      </main>
      {isMobile && (
        <MobileDrawer
          mode={drawerMode}
          onClose={closeDrawer}
          page={page}
          setPage={setPage}
        />
      )}
      <AuthModal />
      <PolicyModal type={policy} onClose={() => setPolicy(null)} />
    </>
  );
}
