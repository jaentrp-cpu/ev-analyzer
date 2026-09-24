export function validWalletAmount(value, allowZero = false) {
  const amount = Number(value);
  return value !== '' && Number.isFinite(amount) && amount <= 100000000 &&
    (allowZero ? amount >= 0 : amount > 0) &&
    Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7;
}

export function canRecordWalletMovement(wallets, { book, kind, target, amount, reason }) {
  const source = wallets.find(wallet => wallet.bookmaker === book);
  if (!source || !reason.trim() || reason.length > 500 ||
      !validWalletAmount(amount, kind === 'reconcile')) return false;
  const value = Number(amount);
  if (kind === 'transfer') {
    return target !== book && wallets.some(wallet => wallet.bookmaker === target) &&
      Number(source.balance) >= value;
  }
  if (kind === 'withdrawal') return Number(source.balance) >= value;
  if (kind === 'reconcile') return Number(source.balance) !== value;
  return kind === 'deposit';
}
