const TABLE = 'user_value_bet_skips';

function requireIdentity(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} puuttuu.`);
  return normalized;
}

export function applyValueBetSkipEvent(currentIds, payload, expectedUserId) {
  const row = payload?.new || payload?.old || {};
  if (String(row.user_id || '') !== String(expectedUserId || '')) return currentIds;
  const betId = String(row.source_bet_id || '').trim();
  if (!betId) return currentIds;
  if (payload.eventType === 'DELETE') return currentIds.filter(id => String(id) !== betId);
  return Array.from(new Set([...currentIds.map(String), betId]));
}

export function createValueBetSkipStore(client) {
  return {
    async load(userId) {
      const ownerId = requireIdentity(userId, 'Käyttäjä');
      const { data, error } = await client
        .from(TABLE)
        .select('source_bet_id')
        .eq('user_id', ownerId);
      if (error) throw error;
      return (data || []).map(row => String(row.source_bet_id)).filter(Boolean);
    },

    async add(userId, sourceBetId) {
      const ownerId = requireIdentity(userId, 'Käyttäjä');
      const betId = requireIdentity(sourceBetId, 'Kohde');
      const { error } = await client
        .from(TABLE)
        .upsert({ user_id: ownerId, source_bet_id: betId }, { onConflict: 'user_id,source_bet_id' });
      if (error) throw error;
    },

    async clear(userId) {
      const ownerId = requireIdentity(userId, 'Käyttäjä');
      const { error } = await client.from(TABLE).delete().eq('user_id', ownerId);
      if (error) throw error;
    },

    subscribe(userId, onEvent) {
      const ownerId = requireIdentity(userId, 'Käyttäjä');
      const channel = client
        .channel(`value-bet-skips:${ownerId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: TABLE,
          filter: `user_id=eq.${ownerId}`,
        }, onEvent)
        .subscribe();
      return () => { client.removeChannel(channel); };
    },
  };
}
