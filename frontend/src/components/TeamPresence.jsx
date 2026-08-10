import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sbClient } from '../supabase.js';
import { useVedox } from '../context/VedoxContext.jsx';

const TEAM_MEMBERS = ['AJ', 'Leo', 'Jalo'];
const REFRESH_MS = 2_000;
const TEAM_ACCOUNT_EMAIL = 'jaentrp@gmail.com';

function emptyPresence() {
  return TEAM_MEMBERS.reduce((all, member) => ({ ...all, [member]: false }), {});
}

function rowsToPresence(rows) {
  const next = emptyPresence();
  for (const row of rows || []) {
    if (TEAM_MEMBERS.includes(row.member_key)) next[row.member_key] = row.is_active === true;
  }
  return next;
}

// This is a manual status for the shared Vedox account only. The control is
// hidden for visitors and other accounts; RLS also keeps each account's rows private.
export default function TeamPresence() {
  const { session, setShowAuth } = useVedox();
  const accountEmail = (session?.user?.email || '').trim().toLowerCase();
  const isTeamAccount = accountEmail === TEAM_ACCOUNT_EMAIL;
  const userId = isTeamAccount ? (session?.user?.id || null) : null;
  const [presence, setPresence] = useState(emptyPresence);
  const [saving, setSaving] = useState({});
  const presenceRef = useRef(presence);

  useEffect(() => { presenceRef.current = presence; }, [presence]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await sbClient
      .from('team_presence')
      .select('member_key, is_active')
      .eq('user_id', userId);
    if (error) {
      console.warn('[Vedox] team presence load failed:', error.message);
      return;
    }
    setPresence(rowsToPresence(data));
  }, [userId]);

  useEffect(() => {
    setPresence(emptyPresence());
    setSaving({});
    if (!userId) return undefined;
    refresh();
    const interval = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [userId, refresh]);

  const toggle = useCallback(async (member) => {
    if (!userId) {
      setShowAuth(true);
      return;
    }
    if (saving[member]) return;

    const wasActive = presenceRef.current[member] === true;
    const isActive = !wasActive;
    setSaving(prev => ({ ...prev, [member]: true }));
    setPresence(prev => ({ ...prev, [member]: isActive }));

    const { error } = await sbClient
      .from('team_presence')
      .upsert({
        user_id: userId,
        member_key: member,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,member_key' });

    if (error) {
      console.warn('[Vedox] team presence save failed:', error.message);
      setPresence(prev => ({ ...prev, [member]: wasActive }));
    }
    setSaving(prev => ({ ...prev, [member]: false }));
  }, [saving, setShowAuth, userId]);

  if (!isTeamAccount) return null;

  return (
    <div className="team-presence" aria-label="Vedox-tiimin paikallaolotila">
      {TEAM_MEMBERS.map((member) => {
        const active = presence[member] === true;
        const state = active ? 'online' : 'offline';
        return (
          <button
            key={member}
            type="button"
            className={'team-presence-member' + (active ? ' is-online' : '')}
            aria-pressed={active}
            aria-label={`${member}: ${state}. Klikkaa vaihtaaksesi tilan.`}
            title={userId ? `${member}: ${state}. Klikkaa vaihtaaksesi tilan.` : 'Kirjaudu sisään asettaaksesi tiimin tilan.'}
            onClick={() => toggle(member)}
            disabled={saving[member] === true}
          >
            <span className="team-presence-dot" aria-hidden="true" />
            <span>{member}</span>
          </button>
        );
      })}
    </div>
  );
}
