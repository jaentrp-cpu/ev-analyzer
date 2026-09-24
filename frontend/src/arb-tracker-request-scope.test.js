import assert from 'node:assert/strict';
import test from 'node:test';
import { createArbTrackerRequestScope } from './arb-tracker-request-scope.js';

test('account changes reject stale loads even after A-B-A switching', () => {
  const scope = createArbTrackerRequestScope(true, 'A');
  const oldA = scope.beginLoad();
  scope.update(true, 'B');
  const b = scope.beginLoad();
  assert.equal(scope.ownsLoad(oldA), false);
  assert.equal(scope.ownsLoad(b), true);
  scope.update(true, 'A');
  assert.equal(scope.ownsLoad(oldA), false);
  assert.equal(scope.ownsLoad(b), false);
});

test('only the newest load for one account can set UI state', () => {
  const scope = createArbTrackerRequestScope(true, 'A');
  const first = scope.beginLoad();
  const second = scope.beginLoad();
  assert.equal(scope.ownsLoad(first), false);
  assert.equal(scope.ownsLoad(second), true);
});

test('actions are single-flight and old completion cannot unlock new owner', () => {
  const scope = createArbTrackerRequestScope(true, 'A');
  const oldAction = scope.beginAction();
  assert.ok(oldAction);
  assert.equal(scope.beginAction(), null);
  scope.update(true, 'B');
  const newAction = scope.beginAction();
  assert.ok(newAction);
  assert.equal(scope.ownsAction(oldAction), false);
  assert.equal(scope.finishAction(oldAction), false);
  assert.equal(scope.beginAction(), null);
  assert.equal(scope.finishAction(newAction), true);
  assert.ok(scope.beginAction());
});

test('disabled or signed-out scopes cannot start actions', () => {
  const scope = createArbTrackerRequestScope(false, 'A');
  assert.equal(scope.beginAction(), null);
  scope.update(true, null);
  assert.equal(scope.beginAction(), null);
});
