import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('./supabase.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('export function steamGradeFromScore'), source.indexOf('function storedSteamSnapshot')).replaceAll('export function', 'function'), context);
test('raw 46.9 never becomes a CLV rating of 80.9', () => {
  const result = context.steamInfoFromRow({steam_quality_score: 46.9});
  assert.equal(result.steamDisplayScore, null);
  assert.equal(result.steamDisplayGrade, null);
  assert.equal(result.legacySteamScore, 46.9);
});
test('learned rating retains its exact value and provenance', () => {
  const result = context.steamInfoFromRow({signal_json: {steam_rating_source: 'steam_rating_rules', steam_rating_value_num: 80.9, steam_rating: 'A'}});
  assert.equal(result.steamDisplayScore, 80.9);
  assert.equal(result.steamDisplayGrade, 'A');
});
test('missing and invalid ratings stay missing', () => {
  for (const value of [null, -1, 101, 'bad']) {
    assert.equal(context.steamInfoFromRow({steam_quality_score: 46.9, signal_json: {steam_rating_source: 'steam_rating_rules', steam_rating_value_num: value}}).steamDisplayScore, null);
  }
});
