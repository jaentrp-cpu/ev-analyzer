import React, { useState } from 'react';
import { useVedox } from '../context/VedoxContext.jsx';
import { VedoxLogo } from './Icon.jsx';

export default function AuthModal() {
  const { showAuth, setShowAuth, signIn, signUp, resetPassword } = useVedox();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [signupBankroll, setSignupBankroll] = useState('');
  const [signupStakePct, setSignupStakePct] = useState('0.5');
  const [accepted, setAccepted] = useState({
    age: false,
    terms: false,
    role: false,
    guarantee: false,
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!showAuth) return null;

  function humanAuthError(err) {
    const raw = String(err?.message || '');
    const msg = raw.toLowerCase();
    if (msg.includes('signups not allowed')) {
      return 'Tunnuksen luonti ei ole vielä päällä Supabasessa. Ylläpidon pitää sallia uudet kirjautumiset Auth-asetuksista.';
    }
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      return 'Tällä sähköpostilla on jo tunnus. Kokeile kirjautua sisään.';
    }
    if (msg.includes('invalid login credentials')) {
      return 'Sähköposti tai salasana on väärin.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Kirjautuminen ei vielä onnistu. Tarkista tunnus tai pyydä ylläpitoa aktivoimaan käyttäjä.';
    }
    if (msg.includes('password')) {
      return 'Tarkista salasana. Sen pitää olla vähintään 6 merkkiä.';
    }
    return raw || 'Toiminto epäonnistui. Yritä hetken päästä uudelleen.';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      if (mode === 'signup') {
        const bankroll = Number(signupBankroll);
        const stakePct = Number(signupStakePct);
        const acceptedAll = accepted.age && accepted.terms && accepted.role && accepted.guarantee;
        if (!Number.isFinite(bankroll) || bankroll <= 0) {
          setMsg('Kirjoita aloituskassa euroina, esimerkiksi 500.');
          setBusy(false);
          return;
        }
        if (!acceptedAll) {
          setMsg('Hyväksy kaikki ehdot ennen tunnuksen luontia.');
          setBusy(false);
          return;
        }
        await signUp(email, pass, {
          bankroll,
          stake_pct: stakePct,
          flat_stake: Math.round(bankroll * (stakePct / 100) * 100) / 100,
        });
        setMsg('Tunnus luotu. Voit nyt kirjautua sisään. Maksulliset näkymät avautuvat, kun ylläpito aktivoi tason.');
        setMode('signin');
      } else {
        await signIn(email, pass);
        setShowAuth(false);
      }
    } catch (err) {
      setMsg(humanAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    setMsg('');
    if (!email) {
      setMsg('Kirjoita sähköpostiosoite ensin.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      setMsg('Salasanan vaihtolinkki lähetetty, jos sähköpostilla löytyy Vedox-tunnus.');
    } catch (err) {
      setMsg(humanAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(8,9,13,0.72)',
        backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
      onMouseDown={e => {
        if (e.target === e.currentTarget) setShowAuth(false);
      }}
    >
      <div
        style={{
          position: 'relative',
          background: 'var(--bg2)', border: '1px solid var(--bd2)',
          borderRadius: 18, padding: '2.25rem 1.75rem',
          width: '100%', maxWidth: mode === 'signup' ? 520 : 410,
          maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <button
          onClick={() => setShowAuth(false)}
          aria-label="Sulje"
          style={{
            position: 'absolute', top: 12, right: 12, width: 30, height: 30,
            border: '1px solid var(--bd)', borderRadius: 10,
            background: 'var(--bg3)', color: 'var(--tx3)',
            cursor: 'pointer', fontSize: '1rem',
          }}
        >×</button>

        <div className="auth-logo-lockup">
          <VedoxLogo size={58} wordmark />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => { setMode('signin'); setMsg(''); }}
            style={{
              border: mode === 'signin' ? '1px solid var(--blue)' : '1px solid var(--bd)',
              background: mode === 'signin' ? 'var(--blue)' : 'var(--bg3)',
              color: mode === 'signin' ? '#fff' : 'var(--tx2)',
              borderRadius: 10,
              padding: '9px 10px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Kirjaudu
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setMsg(''); }}
            style={{
              border: mode === 'signup' ? '1px solid var(--blue)' : '1px solid var(--bd)',
              background: mode === 'signup' ? 'var(--blue)' : 'var(--bg3)',
              color: mode === 'signup' ? '#fff' : 'var(--tx2)',
              borderRadius: 10,
              padding: '9px 10px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Luo tunnus
          </button>
        </div>

        <div style={{
          background: 'var(--blue-soft)', border: '1px solid var(--blue-border)',
          borderRadius: 12, padding: '10px 12px', marginBottom: '1.25rem',
          fontSize: '0.8rem', color: 'var(--tx2)', textAlign: 'center', lineHeight: 1.45,
        }}>
          {mode === 'signup'
            ? 'Voit luoda tunnuksen itse. Uusi tunnus ei näe maksullisia näkymiä ennen kuin ylläpito aktivoi oikean tason.'
            : 'Kirjaudu olemassa olevilla tunnuksilla.'}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '0.9rem' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text3)' }}>Sähköposti</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="sina@email.fi" required
              style={{
                background: 'var(--bg3)', border: '1px solid var(--bd)',
                color: 'var(--tx)', fontSize: '0.88rem', padding: '9px 11px',
                borderRadius: 10, outline: 'none', width: '100%',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '0.9rem' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text3)' }}>Salasana</label>
            <input
              type="password" value={pass} onChange={e => setPass(e.target.value)}
              placeholder="••••••••" required minLength={6}
              style={{
                background: 'var(--bg3)', border: '1px solid var(--bd)',
                color: 'var(--tx)', fontSize: '0.88rem', padding: '9px 11px',
                borderRadius: 10, outline: 'none', width: '100%',
              }}
            />
          </div>
          {mode === 'signup' && (
            <div className="auth-extra">
              <div className="auth-two">
                <label className="auth-field">
                  <span>Aloituskassa (€)</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={signupBankroll}
                    onChange={e => setSignupBankroll(e.target.value)}
                    placeholder="500"
                  />
                </label>
                <label className="auth-field">
                  <span>Varovaisuustaso</span>
                  <select value={signupStakePct} onChange={e => setSignupStakePct(e.target.value)}>
                    <option value="0.25">0,25 % kassasta</option>
                    <option value="0.5">0,5 % kassasta</option>
                    <option value="0.75">0,75 % kassasta</option>
                    <option value="1">1 % kassasta</option>
                    <option value="1.25">1,25 % kassasta</option>
                    <option value="1.5">1,5 % kassasta</option>
                  </select>
                </label>
              </div>
              <p className="auth-hint">
                Kassa ja panostaso tallennetaan lähtöasetuksiksi. Voit muuttaa niitä myöhemmin profiilista.
              </p>
              <div className="auth-checks">
                <label className="auth-check">
                  <input
                    type="checkbox"
                    checked={accepted.age}
                    onChange={e => setAccepted(prev => ({ ...prev, age: e.target.checked }))}
                  />
                  <span>Vakuutan, että olen vähintään 18-vuotias.</span>
                </label>
                <label className="auth-check">
                  <input
                    type="checkbox"
                    checked={accepted.terms}
                    onChange={e => setAccepted(prev => ({ ...prev, terms: e.target.checked }))}
                  />
                  <span>Hyväksyn käyttöehdot, tietosuojan ja vastuullisen pelaamisen periaatteet.</span>
                </label>
                <label className="auth-check">
                  <input
                    type="checkbox"
                    checked={accepted.role}
                    onChange={e => setAccepted(prev => ({ ...prev, role: e.target.checked }))}
                  />
                  <span>Ymmärrän, että Vedox ei ole vedonlyöntivälittäjä eikä ota vastaan panoksia.</span>
                </label>
                <label className="auth-check">
                  <input
                    type="checkbox"
                    checked={accepted.guarantee}
                    onChange={e => setAccepted(prev => ({ ...prev, guarantee: e.target.checked }))}
                  />
                  <span>Ymmärrän, että Vedox ei takaa voittoa ja vastaan itse vedonlyöntipäätöksistäni.</span>
                </label>
              </div>
            </div>
          )}
          <button
            type="submit" disabled={busy}
            style={{
              width: '100%', background: 'var(--blue)', border: 'none', color: '#fff',
              fontSize: '0.88rem', fontWeight: 700, padding: 11,
              borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.5 : 1, marginTop: '0.5rem',
            }}
          >
            {busy ? 'Odota…' : mode === 'signup' ? 'Luo tunnus' : 'Kirjaudu sisään'}
          </button>
        </form>
        {mode === 'signin' && (
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={busy}
            style={{
              display: 'block',
              margin: '10px auto 0',
              border: 0,
              background: 'transparent',
              color: 'var(--blue)',
              fontSize: '0.78rem',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.55 : 1,
            }}
          >
            Unohditko salasanasi?
          </button>
        )}
        {msg && (
          <p style={{
            marginTop: '0.75rem',
            fontSize: '0.78rem',
            textAlign: 'center',
            color: mode === 'signup' && msg.startsWith('Tunnus luotu') ? 'var(--green)' : 'var(--red)',
            lineHeight: 1.45,
          }}>
            {msg}
          </p>
        )}
        <div className="auth-links">
          <a href="#guides">Käyttöehdot</a>
          <a href="#guides">Tietosuoja</a>
          <a href="#guides">Vastuullinen pelaaminen</a>
          <a href="mailto:support@vedox.fi?subject=Vedox%20tuki">Tuki</a>
        </div>
      </div>
    </div>
  );
}
