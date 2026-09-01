const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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

test('does not schedule another login after the single retry also fails', async () => {
  const now = Date.parse('2026-09-02T01:38:23.079Z');
  const scheduled = [];
  let attempts = 0;
  const client = {
    async login() {
      attempts += 1;
      throw new Error('0 remaining; resets at 2026-09-02T01:38:18.079Z');
    },
  };

  loginDiscordWithSessionRetry(client, 'token', {
    now: () => now,
    setTimeout: (fn, delay) => scheduled.push({ fn, delay }),
    logger: { log() {}, error() {} },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(scheduled.length, 1);

  await scheduled[0].fn();
  assert.equal(attempts, 2);
  assert.equal(scheduled.length, 1);
});

test('persists the session reset and skips login after a process restart', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discord-login-'));
  const lockFile = path.join(tempDir, 'session-limit.json');
  const now = Date.parse('2026-09-01T05:30:00.000Z');
  const resetAt = Date.parse('2026-09-02T01:38:18.079Z');
  const firstSchedules = [];
  let firstAttempts = 0;

  loginDiscordWithSessionRetry({
    async login() {
      firstAttempts += 1;
      throw new Error('0 remaining; resets at 2026-09-02T01:38:18.079Z');
    },
  }, 'token', {
    now: () => now,
    lockFile,
    setTimeout: (fn, delay) => firstSchedules.push({ fn, delay }),
    logger: { log() {}, error() {} },
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(firstAttempts, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(lockFile, 'utf8')), { resetAt });

  const restartedSchedules = [];
  let restartedAttempts = 0;
  loginDiscordWithSessionRetry({
    async login() {
      restartedAttempts += 1;
    },
  }, 'token', {
    now: () => now,
    lockFile,
    setTimeout: (fn, delay) => restartedSchedules.push({ fn, delay }),
    logger: { log() {}, error() {} },
  });

  assert.equal(restartedAttempts, 0);
  assert.equal(restartedSchedules.length, 1);
  assert.equal(restartedSchedules[0].delay, resetAt - now + RETRY_BUFFER_MS);
});
