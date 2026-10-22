import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./supabase.js', import.meta.url), 'utf8');
const match = source.match(/function isPublicValueBet\(row\) \{[\s\S]*?\n\}/);
assert.ok(match, 'isPublicValueBet must remain directly testable');

const context = vm.createContext({ Number });
vm.runInContext(match[0], context);

test('public accepts every valid scanner-published EV row without a stale UI ceiling', () => {
  assert.equal(context.isPublicValueBet({ edge: 8, odds: 2.5 }), true);
  assert.equal(context.isPublicValueBet({ edge: 9.4, odds: 2.2 }), true);
  assert.equal(context.isPublicValueBet({ edge: 10, odds: 2.5 }), true);
  assert.equal(context.isPublicValueBet({ edge: 12, odds: 3.5 }), true);
});

test('public still rejects malformed quote values', () => {
  assert.equal(context.isPublicValueBet({ edge: 0, odds: 2 }), false);
  assert.equal(context.isPublicValueBet({ edge: 5, odds: 1 }), false);
  assert.equal(context.isPublicValueBet({ edge: 'not-a-number', odds: 2 }), false);
  assert.equal(context.isPublicValueBet({ edge: 5, odds: 'not-a-number' }), false);
});
