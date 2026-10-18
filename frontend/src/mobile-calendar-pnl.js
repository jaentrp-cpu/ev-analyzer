export function formatMobileCalendarPnl(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${number >= 0 ? '+' : '-'}${Math.abs(number).toLocaleString('fi-FI', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).replace(/\s+/g, '')}`;
}
