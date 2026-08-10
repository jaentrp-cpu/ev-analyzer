import React, { useEffect, useRef } from 'react';
import { useTheme } from '../theme.jsx';
import { Icon, iconFor, VedoxLogo } from './Icon.jsx';
import TeamPresence from './TeamPresence.jsx';
import { useVedox } from '../context/VedoxContext.jsx';
import { formatKellyFraction, KELLY_FRACTIONS } from '../staking.js';

const TABS = [
  { id: 'home', lbl: 'Etusivu' },
  { id: 'value', lbl: 'Arvovedot' },
  { id: 'sure', lbl: 'Varmavedot' },
  { id: 'mybets', lbl: 'Omat vedot & analytiikka' },
  { id: 'guides', lbl: 'Ohjeet' },
  { id: 'news', lbl: 'Ajankohtaista' },
];

const SERVICE_TABS = [
  { id: 'subscriptions', lbl: 'Tilaukset' },
  { id: 'socials', lbl: 'Socials' },
];

// Mobile chrome: header bar, bottom tab nav, side drawer for overflow pages.
export function MobileTop({ page, onMenu, onProfile }) {
  const { theme, setTheme } = useTheme();
  const { session, profile, setShowAuth } = useVedox();
  const cur = [...TABS, ...SERVICE_TABS].find((tab) => tab.id === page) || TABS[0];
  const username = profile?.username || session?.user?.email?.split('@')?.[0] || '';
  const initial = username ? username.slice(0, 1).toUpperCase() : 'K';

  return (
    <div className="mob-top">
      <button className="ib" onClick={onMenu} aria-label="Avaa valikko">
        <Icon name="menu" size={16} />
      </button>
      <VedoxLogo size={22} />
      <div className="ti">{cur.lbl}</div>
      <div className="grow" />
      <TeamPresence />
      <button
        className="ib"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title="Vaihda teema"
        aria-label="Vaihda teema"
      >
        <Icon
          name={theme === 'dark' ? 'sun' : 'moon'}
          size={14}
          fill={theme === 'dark' ? 'none' : 'currentColor'}
        />
      </button>
      <button
        className="ib mob-profile-trigger"
        onClick={() => session ? onProfile() : setShowAuth(true)}
        title={session ? 'Avaa profiili ja asetukset' : 'Kirjaudu sisään'}
        aria-label={session ? 'Avaa profiili ja asetukset' : 'Avaa kirjautuminen'}
      >
        <span className="av" aria-hidden="true">{initial}</span>
      </button>
    </div>
  );
}

export function BottomNav({ page, setPage, openMore }) {
  const items = [
    { id: 'home', lbl: 'Etusivu' },
    { id: 'value', lbl: 'Arvo' },
    { id: 'sure', lbl: 'Varma' },
    { id: 'mybets', lbl: 'Omat' },
  ];
  return (
    <div className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.id}
          className={page === item.id ? 'on' : ''}
          onClick={() => setPage(item.id)}
        >
          <Icon name={iconFor(item.id)} size={18} stroke={1.7} />
          <div className="lb">{item.lbl}</div>
          <div className="dot" />
        </button>
      ))}
      <button
        onClick={openMore}
        className={['guides', 'news', 'subscriptions', 'socials'].includes(page) ? 'on' : ''}
      >
        <Icon name="menu" size={18} stroke={1.7} />
        <div className="lb">Lisää</div>
        <div className="dot" />
      </button>
    </div>
  );
}

export function MobileDrawer({ mode = 'closed', onClose, page, setPage }) {
  const { theme, setTheme } = useTheme();
  const {
    session, profile, tierLabel, bankroll, baseBankroll, totalBookBalance,
    fixedFlatStake, setFlatStake,
    stakeMode, setStakeMode, stakePct, setStakePct,
    kellyFraction, setKellyFraction, setBankroll,
    setShowAuth, signOut, lang, setLang,
    settingsSaveStatus, settingsSaveError,
  } = useVedox();
  const drawerRef = useRef(null);
  const closeRef = useRef(null);
  const previousFocusRef = useRef(null);
  const open = mode === 'menu' || mode === 'profile';
  const profileMode = mode === 'profile';

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;

      const focusable = [...drawerRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  const username = profile?.username || session?.user?.email?.split('@')?.[0] || '';
  const initial = username ? username.slice(0, 1).toUpperCase() : 'K';

  function go(id) {
    setPage(id);
    onClose();
  }

  return (
    <div
      className="mob-drawer-wrap"
      role="dialog"
      aria-modal="true"
      aria-label={profileMode ? 'Profiili ja asetukset' : 'Valikko'}
    >
      <div className="mob-drawer-bd" onClick={onClose} aria-hidden="true" />
      <div className="mob-drawer" ref={drawerRef}>
        <div className="mob-drawer-head">
          <div className="brand">
            <VedoxLogo size={28} />
            <div className="brand-text">
              Vedox
              <div>Logic Over Luck</div>
            </div>
          </div>
          <button ref={closeRef} className="ib" onClick={onClose} aria-label="Sulje valikko">
            ×
          </button>
        </div>

        {!profileMode && (
          <>
            <div className="sect">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={'navlink' + (page === tab.id ? ' on' : '')}
                  onClick={() => go(tab.id)}
                >
                  <Icon name={iconFor(tab.id)} size={14} className="ic" />
                  <span>{tab.lbl}</span>
                </button>
              ))}
            </div>

            <div className="sect">
              <h5>Palvelu</h5>
              {SERVICE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={'navlink' + (page === tab.id ? ' on' : '')}
                  onClick={() => go(tab.id)}
                >
                  <Icon name={tab.id === 'subscriptions' ? 'guides' : 'news'} size={14} className="ic" />
                  <span>{tab.lbl}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {profileMode && (
          <div className="sect mob-profile-settings">
            <h5>Profiili & asetukset</h5>
            {session ? (
              <>
                <div className="mob-profile-id">
                  <div className="av">{initial}</div>
                  <div>
                    <strong>{username}</strong>
                    <small>{tierLabel || 'Beta'}</small>
                  </div>
                </div>

                <div className="mob-current-bankroll">
                  <span>Kassa nyt</span>
                  <strong>
                    {Number.isFinite(Number(bankroll))
                      ? `${Number(bankroll).toLocaleString('fi-FI', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} €`
                      : '—'}
                  </strong>
                  {totalBookBalance > 0 && (
                    <small>Muodostuu vedonvälittäjäkassojen summasta.</small>
                  )}
                </div>

                <label className="mob-setting-field">
                  <span>Aloituskassa</span>
                  <input
                    type="number"
                    min="0"
                    value={baseBankroll || ''}
                    onChange={(event) => setBankroll(parseFloat(event.target.value) || 0)}
                  />
                </label>

                <span className="mob-setting-label">Panosmalli</span>
                <div className="mob-setting-buttons">
                  <button
                    className={stakeMode === 'percent' ? 'on' : ''}
                    onClick={() => setStakeMode('percent')}
                  >
                    {stakePct} % kassasta
                  </button>
                  <button
                    className={stakeMode === 'fixed' ? 'on' : ''}
                    onClick={() => setStakeMode('fixed')}
                  >
                    Kiinteä
                  </button>
                  <button
                    className={stakeMode === 'kelly' ? 'on' : ''}
                    onClick={() => setStakeMode('kelly')}
                  >
                    Kelly
                  </button>
                </div>

                {stakeMode === 'percent' && (
                  <label className="mob-setting-field">
                    <span>Prosentti kassasta</span>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={stakePct}
                      onChange={(event) => setStakePct(parseFloat(event.target.value) || 1)}
                    />
                  </label>
                )}
                {stakeMode === 'fixed' && (
                  <label className="mob-setting-field">
                    <span>Kiinteä panos</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={fixedFlatStake}
                      onChange={(event) => setFlatStake(parseFloat(event.target.value) || 1)}
                    />
                  </label>
                )}
                {stakeMode === 'kelly' && (
                  <>
                    <span className="mob-setting-label">
                      Kellyn varovaisuusaste · enintään 5 % / veto
                    </span>
                    <div className="mob-setting-buttons compact">
                      {KELLY_FRACTIONS.map((fraction) => (
                        <button
                          key={fraction}
                          className={kellyFraction === fraction ? 'on' : ''}
                          onClick={() => setKellyFraction(fraction)}
                        >
                          {formatKellyFraction(fraction, lang)}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div
                  className={`settings-save-state ${settingsSaveStatus || 'idle'}`}
                  role={settingsSaveStatus === 'error' ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {settingsSaveStatus === 'saving' && 'Tallennetaan asetuksia…'}
                  {settingsSaveStatus === 'saved' && 'Asetukset tallennettu.'}
                  {settingsSaveStatus === 'error' && (
                    settingsSaveError || 'Asetusten tallennus epäonnistui. Muutos palautettiin.'
                  )}
                </div>

                <span className="mob-setting-label">Kieli</span>
                <div className="mob-setting-buttons compact">
                  <button className={lang === 'fi' ? 'on' : ''} onClick={() => setLang('fi')}>
                    Suomi
                  </button>
                  <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
                    English
                  </button>
                </div>

                <button
                  className="mob-signout"
                  onClick={() => {
                    signOut();
                    onClose();
                  }}
                >
                  Kirjaudu ulos
                </button>
              </>
            ) : (
              <button
                className="btn p mob-login"
                onClick={() => {
                  setShowAuth(true);
                  onClose();
                }}
              >
                Kirjaudu sisään
              </button>
            )}
          </div>
        )}

        <div className="mob-drawer-foot">
          <div className="theme-switch">
            <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>
              <Icon name="sun" size={12} />
              Light
            </button>
            <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>
              <Icon name="moon" size={12} fill="currentColor" />
              Dark
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
