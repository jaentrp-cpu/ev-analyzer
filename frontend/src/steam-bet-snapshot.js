export function createSteamBetSnapshot(bet, capturedAt = new Date().toISOString()) {
  const display = Object.fromEntries(
    Object.entries(bet || {}).filter(([key]) => key.startsWith('steam') || key.startsWith('legacySteam')),
  );
  const hasDisplayValue = Object.values(display)
    .some(value => value !== null && value !== undefined && value !== '');
  if (!hasDisplayValue) return null;
  return {
    schema_version: 1,
    captured_at: capturedAt,
    display,
  };
}
