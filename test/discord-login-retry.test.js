const assert = require('node:assert/strict');
const test = require('node:test');

const {
  RETRY_BUFFER_MS,
  loginDiscordWithSessionRetry,
  sessionResetAtFromError,
} = require('../utils/discord-login-retry');

test('reads the Discord session reset timestamp from the login error', () => {
  const resetAt = sessionResetAtFromError(
    new Error('Not enough sessions remaining; resets at 2026-09-02T01:38:18.079Z')
  );
  assert.equal(resetAt, Date.parse('2026-09-02T01:38:18.079Z'));
});

test('schedules one login retry just after the session limit resets', async () => {
  const now = Date.parse('2026-09-01T05:30:00.000Z');
  const resetAt = Date.parse('2026-09-02T01:38:18.079Z');
  const scheduled = [];
  const errors = [];
  const client = {
    async login() {
      throw new Error('0 remaining; resets at 2026-09-02T01:38:18.079Z');
    },
  };

  loginDiscordWithSessionRetry(client, 'token', {
    now: () => now,
    setTimeout: (fn, delay) => scheduled.push({ fn, delay }),
    logger: { log() {}, error: (...args) => errors.push(args) },
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, resetAt - now + RETRY_BUFFER_MS);
  assert.equal(errors.length, 1);
});
