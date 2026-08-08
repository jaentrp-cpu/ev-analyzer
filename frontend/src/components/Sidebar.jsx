import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../theme.jsx';
import { Icon, iconFor, VedoxLogo } from './Icon.jsx';
import { useVedox } from '../context/VedoxContext.jsx';
import { formatKellyFraction, KELLY_FRACTIONS } from '../staking.js';

const LABELS = {
  fi: {
    work: 'Työpöytä',
    resources: 'Resurssit',
    legal: 'Palvelu',
    home: 'Etusivu',
    value: 'Arvovedot',
    sure: 'Varmavedot',
    mybets: 'Omat vedot & analytiikka',
    guides: 'Ohjeet',
    news: 'Ajankohtaista',
    bankroll: 'Kassa nyt',
    startingBankroll: 'Aloituskassa',
    stake: 'Panos',
    stakeModel: 'Panosmalli',
    percentStake: 'kassasta',
    fixed: 'Kiinteä',
    kelly: 'Kelly',
    kellyCaution: 'Kellyn varovaisuusaste',
    kellyStake: 'Kohdekohtainen · enintään 5 % kassasta',
    theme: 'Teema',
    language: 'Kieli / Language',
    profileSettings: 'Profiili & asetukset',
    profileSoon: 'Vedox rakentaa profiili- ja asetukset-näkymää parhaillaan.',
    logout: 'Kirjaudu ulos',
    login: 'Kirjaudu sisään',
    guest: 'Kirjaudu sisään nähdäksesi arvovedot ja omat tilastosi.',
    terms: 'Käyttöehdot',
    privacy: 'Tietosuoja',
    responsible: 'Vastuullinen pelaaminen',
    subscriptions: 'Tilaukset',
    socials: 'Socials',
  },
  en: {
    work: 'Desk',
    resources: 'Resources',
    legal: 'Service',
    home: 'Home',
    value: 'Value bets',
    sure: 'Sure bets',
    mybets: 'Bets & analytics',
    guides: 'Guides',
    news: 'News',
    bankroll: 'Bankroll now',
    startingBankroll: 'Starting bankroll',
    stake: 'Stake',
    stakeModel: 'Stake model',
    percentStake: 'of bankroll',
    fixed: 'Fixed',
    kelly: 'Kelly',
    kellyCaution: 'Kelly fraction',
    kellyStake: 'Per bet · max 5% of bankroll',
    theme: 'Theme',
    language: 'Language',
    profileSettings: 'Profile & settings',
    profileSoon: 'Vedox is currently building the profile and settings view.',
    logout: 'Sign out',
    login: 'Sign in',
    guest: 'Sign in to see value bets and your own statistics.',
    terms: 'Terms',
    privacy: 'Privacy',
    responsible: 'Responsible gambling',
    subscriptions: 'Subscriptions',
    socials: 'Socials',
  },
};

const TABS = [
  { id: 'home' },
  { id: 'value' },
  { id: 'sure' },
  { id: 'mybets' },
  { id: 'guides' },
  { id: 'news' },
];

export default function Sidebar({ page, setPage, onPolicy }) {
  const { theme, setTheme } = useTheme();
  const { stats, profile, tierLabel, bankroll, baseBankroll, flatStake, fixedFlatStake, setFlatStake,
          stakeMode, setStakeMode, stakePct, setStakePct,
          kellyFraction, setKellyFraction,
          setBankroll, setShowAuth, signOut, session, canAccess, lang, setLang,
          settingsSaveStatus, settingsSaveError } = useVedox();
  const [open, setOpen] = useState(false);
  const [profileNotice, setProfileNotice] = useState(false);
  const [stakeInput, setStakeInput] = useState('');
  const ref = useRef(null);
  const t = LABELS[lang] || LABELS.fi;

  useEffect(() => {
    if (stakeMode === 'kelly') {
      setStakeInput('');
      return;
    }
    setStakeInput(String(stakeMode === 'percent' ? stakePct : fixedFlatStake));
  }, [stakeMode, stakePct, fixedFlatStake]);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const counts = {
    value:  stats.arvovedot   || null,
    sure:   stats.varmavedot  || null,
    mybets: stats.omatAvoimet > 0 ? stats.omatAvoimet : null,
  };

  const username = profile?.username || null;
  const initial  = username ? username.slice(0, 1).toUpperCase() : 'K';
  const isLoggedIn = !!session;

  function nav(id) {
    if (!canAccess(id) && !session) { setShowAuth(true); return; }
    setPage(id);
  }

  function commitStakeInput() {
    if (stakeMode === 'kelly') return;
    const value = parseFloat(stakeInput);
    if (!Number.isFinite(value) || value <= 0) {
      setStakeInput(String(stakeMode === 'percent' ? stakePct : fixedFlatStake));
      return;
    }
    if (stakeMode === 'percent') setStakePct(value);
    else setFlatStake(value);
  }

  return (
    <aside className="side">
      <div className="brand">
        <VedoxLogo size={28} />
        <div className="nm">Vedox<small>Logic Over Luck</small></div>
      </div>

      <div className="sect">
        <h5>{t.work}</h5>
        {TABS.slice(0, 4).map(t => (
          <div key={t.id}
            className={'navlink' + (page === t.id ? ' on' : '') + (!canAccess(t.id) ? ' locked' : '')}
            onClick={() => nav(t.id)}>
            <Icon name={iconFor(t.id)} size={14} className="ic" />
            {LABELS[lang]?.[t.id] || LABELS.fi[t.id]}
            {counts[t.id] != null && <span className="ct">{counts[t.id]}</span>}
            {!canAccess(t.id) && <Icon name="lock" size={12} className="lockmark" />}
          </div>
        ))}
      </div>

      <div className="sect">
        <h5>{t.resources}</h5>
        {TABS.slice(4).map(t => (
          <div key={t.id} className={'navlink' + (page === t.id ? ' on' : '')} onClick={() => setPage(t.id)}>
            <Icon name={iconFor(t.id)} size={14} className="ic" />
            {LABELS[lang]?.[t.id] || LABELS.fi[t.id]}
          </div>
        ))}
      </div>

      <div className="sect legal-links">
        <h5>{t.legal}</h5>
        <button className={page === 'subscriptions' ? 'on' : ''} onClick={() => setPage('subscriptions')}>{t.subscriptions}</button>
        <button className={page === 'socials' ? 'on' : ''} onClick={() => setPage('socials')}>{t.socials}</button>
        <button onClick={() => onPolicy?.('terms')}>{t.terms}</button>
        <button onClick={() => onPolicy?.('privacy')}>{t.privacy}</button>
        <button onClick={() => onPolicy?.('responsible')}>{t.responsible}</button>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div className="theme-switch">
          <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}><Icon name="sun" size={12} />Light</button>
          <button className={theme === 'dark'  ? 'on' : ''} onClick={() => setTheme('dark')}><Icon name="moon" size={12} fill="currentColor" />Dark</button>
        </div>

        <div ref={ref} style={{ position: 'relative' }}>
          {/* Profiilipopup */}
          {open && (
            <div className="profile-pop">
              {isLoggedIn ? (
                <>
                  <div className="profile-head">
                    <div className="av">{initial}</div>
                    <div className="profile-id">
                      <strong>{username}</strong>
                      <span>{tierLabel || 'Beta'}</span>
                    </div>
                  </div>

                  <div className="profile-metrics">
                    <label>
                      <span>{t.bankroll}</span>
                      <b>{bankroll > 0 ? bankroll.toLocaleString('fi-FI') + ' €' : '—'}</b>
                      <span className="bankroll-input-label">{t.startingBankroll}</span>
                      <input type="number" value={baseBankroll || ''} min={0} placeholder="0"
                        aria-label={t.startingBankroll}
                        onChange={e => setBankroll(parseFloat(e.target.value) || 0)} />
                    </label>
                    <label>
                      <span>{t.stake}</span>
                      <b>{stakeMode === 'kelly'
                        ? `${t.kelly} ${formatKellyFraction(kellyFraction, lang)}`
                        : `${flatStake.toLocaleString('fi-FI')} €`}</b>
                      {stakeMode === 'kelly' ? (
                        <span className="kelly-stake-note">{t.kellyStake}</span>
                      ) : (
                        <input type="number" value={stakeInput} min={stakeMode === 'percent' ? 0.1 : 1} step={stakeMode === 'percent' ? 0.1 : 1}
                          title={stakeMode === 'percent' ? 'Prosentti kassasta' : 'Kiinteä flat stake'}
                          onChange={e => {
                            const next = e.target.value;
                            setStakeInput(next);
                            const value = parseFloat(next);
                            if (Number.isFinite(value) && value > 0) {
                              if (stakeMode === 'percent') setStakePct(value);
                              else setFlatStake(value);
                            }
                          }}
                          onBlur={commitStakeInput} />
                      )}
                    </label>
                  </div>

                  <div className="profile-block">
                    <span className="profile-label">{t.stakeModel}</span>
                    <div className="lang-switch stake-model-switch">
                      <button className={stakeMode === 'percent' ? 'on' : ''} onClick={() => setStakeMode('percent')}>{stakePct} % {t.percentStake}</button>
                      <button className={stakeMode === 'fixed' ? 'on' : ''} onClick={() => setStakeMode('fixed')}>{t.fixed}</button>
                      <button className={stakeMode === 'kelly' ? 'on' : ''} onClick={() => setStakeMode('kelly')}>{t.kelly}</button>
                    </div>
                  </div>

                  {stakeMode === 'kelly' && (
                    <div className="profile-block">
                      <span className="profile-label">{t.kellyCaution}</span>
                      <div className="lang-switch kelly-fraction-switch">
                        {KELLY_FRACTIONS.map(fraction => (
                          <button
                            key={fraction}
                            className={kellyFraction === fraction ? 'on' : ''}
                            onClick={() => setKellyFraction(fraction)}
                          >
                            {formatKellyFraction(fraction, lang)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={`settings-save-state ${settingsSaveStatus || 'idle'}`}
                    role={settingsSaveStatus === 'error' ? 'alert' : 'status'}
                    aria-live="polite"
                  >
                    {settingsSaveStatus === 'saving' && (lang === 'en' ? 'Saving settings…' : 'Tallennetaan asetuksia…')}
                    {settingsSaveStatus === 'saved' && (lang === 'en' ? 'Settings saved.' : 'Asetukset tallennettu.')}
                    {settingsSaveStatus === 'error' && (
                      settingsSaveError || (lang === 'en'
                        ? 'Settings could not be saved. The previous value was restored.'
                        : 'Asetusten tallennus epäonnistui. Edellinen arvo palautettiin.')
                    )}
                  </div>

                  <div className="profile-block">
                    <span className="profile-label">{t.theme}</span>
                    <div className="theme-switch">
                      <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}><Icon name="sun" size={11} />Light</button>
                      <button className={theme === 'dark'  ? 'on' : ''} onClick={() => setTheme('dark')}><Icon name="moon" size={11} fill="currentColor" />Dark</button>
                    </div>
                  </div>

                  <div className="profile-block">
                    <span className="profile-label">{t.language}</span>
                    <div className="lang-switch">
                      <button className={lang === 'fi' ? 'on' : ''} onClick={() => setLang('fi')}>Suomi</button>
                      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
                    </div>
                  </div>

                  <div className="profile-links">
                    <button onClick={() => setProfileNotice(true)}><Icon name="gear" size={12} /> {t.profileSettings}</button>
                    {profileNotice && <div className="profile-note">{t.profileSoon}</div>}
                    <button className="logout" onClick={() => { signOut(); setOpen(false); }}>← {t.logout}</button>
                  </div>
                </>
              ) : (
                <div className="profile-guest">
                  <p>{t.guest}</p>
                  <button className="btn p" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => { setShowAuth(true); setOpen(false); }}>
                    {t.login}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Me-rivi */}
          <div className="me" onClick={() => setOpen(p => !p)} style={{ cursor: 'pointer' }}>
            <div className="av">{initial}</div>
            <div className="n">
              {isLoggedIn ? (
                <>{username}<small style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tierLabel ? `${tierLabel} · ` : ''}{bankroll > 0 ? bankroll.toLocaleString('fi-FI') + ' €' : ''}</small></>
              ) : (
                <>Kirjaudu<small>Beta</small></>
              )}
            </div>
            <span className="ib" title="Avaa profiili" style={{ width: 24, height: 24 }}>
              <Icon name="chev" size={12} />
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
