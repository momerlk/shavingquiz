import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, snapshot, control, validVote } from './server.js';

test('survey validation and five-minute presenter timeline', () => {
  const state = freshState();
  assert.equal(validVote({ id: '123e4567-e89b-42d3-a456-426614174000', place: 'room', reaction: 'both', confidence: 'self' }), true);
  assert.equal(validVote({ id: '123e4567-e89b-42d3-a456-426614174000', place: 'invalid', reaction: 'both', confidence: 'self' }), false);
  assert.equal(control(state, 'start', 1000), true);
  assert.equal(snapshot(state, 61000).elapsedMs, 60000);
  assert.equal(control(state, 'pause', 61000), true);
  assert.equal(snapshot(state, 90000).elapsedMs, 60000);
  assert.equal(control(state, 'resume', 90000), true);
  assert.equal(snapshot(state, 330000).status, 'ended');
  assert.equal(control(state, 'pause', 330000), false);
  assert.equal(control(state, 'reset-timer', 330000), true);
  assert.equal(snapshot(state, 330000).status, 'lobby');
  assert.equal(snapshot(state, 330000).elapsedMs, 0);
});
