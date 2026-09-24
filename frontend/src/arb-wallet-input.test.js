import assert from 'node:assert/strict';
import { canRecordWalletMovement, validWalletAmount } from './arb-wallet-input.js';

assert.equal(validWalletAmount('0.29'), true);
assert.equal(validWalletAmount('0'), false);
assert.equal(validWalletAmount('0', true), true);
assert.equal(validWalletAmount('1.001'), false);
assert.equal(validWalletAmount('100000001'), false);
assert.equal(validWalletAmount('Infinity'), false);

const wallets = [
  { bookmaker: 'CoolBet', balance: '1.00' },
  { bookmaker: 'Bet365', balance: '0.00' },
];
const base = { book: 'CoolBet', kind: 'deposit', amount: '0.29', reason: 'Talletus' };
assert.equal(canRecordWalletMovement(wallets, base), true);
assert.equal(canRecordWalletMovement(wallets, { ...base, kind: 'withdrawal', amount: '1.01' }), false);
assert.equal(canRecordWalletMovement(wallets, { ...base, kind: 'withdrawal', amount: '1.00' }), true);
assert.equal(canRecordWalletMovement(wallets, { ...base, kind: 'reconcile', amount: '1.00' }), false);
assert.equal(canRecordWalletMovement(wallets, { ...base, kind: 'reconcile', amount: '0' }), true);
assert.equal(canRecordWalletMovement(wallets, { ...base, kind: 'transfer', target: 'Bet365' }), true);
assert.equal(canRecordWalletMovement(wallets, { ...base, kind: 'transfer', target: 'CoolBet' }), false);
assert.equal(canRecordWalletMovement(wallets, { ...base, kind: 'transfer', target: 'Other' }), false);
assert.equal(canRecordWalletMovement([], base), false);
