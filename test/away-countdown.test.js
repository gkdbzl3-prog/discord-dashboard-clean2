const assert = require('node:assert/strict');
const test = require('node:test');

let away = {};
try {
  away = require('../away-countdown');
} catch (_) {}

test('accepts HH:mm and rejects invalid departure times', () => {
  assert.equal(typeof away.parseDepartureTime, 'function');
  assert.deepEqual(away.parseDepartureTime('08:30'), { hour: 8, minute: 30 });
  assert.equal(away.parseDepartureTime('24:00'), null);
  assert.equal(away.parseDepartureTime('8시 30분'), null);
});

test('uses the next occurrence of a Korean departure time', () => {
  assert.equal(typeof away.nextKstDepartureAt, 'function');
  const before = Date.parse('2026-09-01T04:00:00.000Z'); // KST 13:00
  const after = Date.parse('2026-09-01T06:00:00.000Z');  // KST 15:00

  assert.equal(
    new Date(away.nextKstDepartureAt('14:30', before)).toISOString(),
    '2026-09-01T05:30:00.000Z',
  );
  assert.equal(
    new Date(away.nextKstDepartureAt('14:30', after)).toISOString(),
    '2026-09-02T05:30:00.000Z',
  );
});

test('rounds remaining partial minutes up and stays at zero after departure', () => {
  assert.equal(typeof away.minutesUntilDeparture, 'function');
  const targetAt = Date.parse('2026-09-01T05:30:00.000Z');
  assert.equal(away.minutesUntilDeparture(targetAt, targetAt - 60_001), 2);
  assert.equal(away.minutesUntilDeparture(targetAt, targetAt - 60_000), 1);
  assert.equal(away.minutesUntilDeparture(targetAt, targetAt), 0);
  assert.equal(away.minutesUntilDeparture(targetAt, targetAt + 30_000), 0);
});

test('exposes the full message and clamped countdown to the overlay', () => {
  assert.equal(typeof away.awayOverlaySnapshot, 'function');
  const state = {
    message: '🏥 병원 진료',
    departureTime: '14:30',
    targetAt: Date.parse('2026-09-01T05:30:00.000Z'),
  };

  assert.deepEqual(
    away.awayOverlaySnapshot(state, Date.parse('2026-09-01T05:00:30.000Z')),
    {
      active: true,
      message: '🏥 병원 진료',
      departureTime: '14:30',
      targetAt: state.targetAt,
      minutesRemaining: 30,
    },
  );
  assert.equal(
    away.awayOverlaySnapshot(state, Date.parse('2026-09-01T06:00:00.000Z')).minutesRemaining,
    0,
  );
  assert.deepEqual(away.awayOverlaySnapshot(null), { active: false });
});

test('formats the Discord voice status with the full message', () => {
  assert.equal(typeof away.formatVoiceStatus, 'function');
  assert.equal(
    away.formatVoiceStatus('🏥 병원 진료', '14:30'),
    '🏥 병원 진료 | 14:30 외출 예정',
  );
});

test('selects the requested guild countdown and otherwise finds an active one', () => {
  assert.equal(typeof away.selectAwayState, 'function');
  const first = { message: '마트', targetAt: 1000 };
  const second = { message: '병원', targetAt: 2000 };
  const root = {
    guilds: {
      first: { settings: { awayCountdown: first } },
      second: { settings: { awayCountdown: second } },
    },
  };

  assert.equal(away.selectAwayState(root, 'second'), second);
  assert.equal(away.selectAwayState(root), first);
  assert.equal(away.selectAwayState({ guilds: {} }), null);
});

test('prefers the data default guild and otherwise the newest countdown', () => {
  const oldState = { message: 'old', createdAt: 10 };
  const defaultState = { message: 'default', createdAt: 20 };
  const newestState = { message: 'newest', createdAt: 30 };
  const root = {
    meta: { defaultGuildId: 'second' },
    guilds: {
      first: { settings: { awayCountdown: oldState } },
      second: { settings: { awayCountdown: defaultState } },
      third: { settings: { awayCountdown: newestState } },
    },
  };

  assert.equal(away.selectAwayState(root), defaultState);
  root.meta.defaultGuildId = 'missing';
  assert.equal(away.selectAwayState(root), newestState);
});
