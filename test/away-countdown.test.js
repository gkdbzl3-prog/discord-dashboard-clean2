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
  const now = Date.parse('2026-09-01T04:00:00.000Z'); // KST 13:00
  const state = away.createAwayCountdown({
    message: '🏥 병원 진료',
    departureTime: '15:00',
    travelMinutes: 40,
    userId: 'u1',
    now,
  });

  assert.deepEqual(away.awayOverlaySnapshot(state, now), {
    active: true,
    message: '🏥 병원 진료',
    departureTime: '15:00',
    awayTime: '13:20',
    departTime: '14:20',
    arriveTime: '15:00',
    travelMinutes: 40,
    headline: '13:20에 자리 비움 | 🏥 병원 진료',
    detail: '14:20에 출발 · 15:00 도착',
    targetAt: Date.parse('2026-09-01T04:20:00.000Z'),
    minutesRemaining: 20,
  });
  assert.equal(
    away.awayOverlaySnapshot(state, Date.parse('2026-09-01T05:00:00.000Z')).minutesRemaining,
    0,
  );
  assert.deepEqual(away.awayOverlaySnapshot(null), { active: false });
});

test('reads a duration only when it carries a Korean unit', () => {
  assert.equal(typeof away.parseDurationMinutes, 'function');
  assert.equal(away.parseDurationMinutes('40분'), 40);
  assert.equal(away.parseDurationMinutes('1시간'), 60);
  assert.equal(away.parseDurationMinutes('1시간20분'), 80);
  assert.equal(away.parseDurationMinutes('40'), null);
  assert.equal(away.parseDurationMinutes('병원'), null);
  assert.equal(away.parseDurationMinutes(''), null);
  assert.equal(away.parseDurationMinutes('0분'), null);
});

test('subtracts the travel time and then the hour of getting ready', () => {
  assert.equal(typeof away.awayPlan, 'function');
  const now = Date.parse('2026-09-01T04:00:00.000Z'); // KST 13:00
  const plan = away.awayPlan({ departureTime: '15:00', travelMinutes: 40, now });

  assert.equal(new Date(plan.arriveAt).toISOString(), '2026-09-01T06:00:00.000Z'); // 15:00
  assert.equal(new Date(plan.departAt).toISOString(), '2026-09-01T05:20:00.000Z'); // 14:20
  assert.equal(new Date(plan.awayAt).toISOString(), '2026-09-01T04:20:00.000Z');   // 13:20
  assert.equal(plan.prepMinutes, away.PREP_MINUTES);
  assert.equal(away.PREP_MINUTES, 60);
});

test('leaves the desk an hour early when no travel time was given', () => {
  const now = Date.parse('2026-09-01T04:00:00.000Z'); // KST 13:00
  const plan = away.awayPlan({ departureTime: '15:00', now });

  assert.equal(plan.departAt, plan.arriveAt);
  assert.equal(new Date(plan.awayAt).toISOString(), '2026-09-01T05:00:00.000Z'); // 14:00
});

test('draws a stored countdown from before travel and prep existed', () => {
  const snapshot = away.awayOverlaySnapshot(
    { message: '🏥 병원', departureTime: '14:30', targetAt: Date.parse('2026-09-01T05:30:00.000Z') },
    Date.parse('2026-09-01T05:00:30.000Z'),
  );

  assert.equal(snapshot.headline, '14:30에 자리 비움 | 🏥 병원');
  assert.equal(snapshot.detail, '14:30에 출발');
  assert.equal(snapshot.minutesRemaining, 30);
});

test('shows the same three lines back to the person who typed them', () => {
  assert.equal(typeof away.awayOverlayReply, 'function');
  const now = Date.parse('2026-09-01T04:00:00.000Z'); // KST 13:00
  const state = away.createAwayCountdown({
    message: '병원',
    departureTime: '15:00',
    travelMinutes: 40,
    userId: 'u1',
    now,
  });

  assert.equal(
    away.awayOverlayReply(state, now),
    '13:20에 자리 비움 | 병원\n14:20에 출발 · 15:00 도착\n20분 남음',
  );
  assert.equal(away.awayOverlayReply(null), '시각을 못 읽었어');
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

test('formats the overlay headline as the away time plus reason', () => {
  assert.equal(typeof away.formatAwayHeadline, 'function');
  assert.equal(
    away.formatAwayHeadline('🏥 병원', '14:30'),
    '14:30에 자리 비움 | 🏥 병원',
  );
});

test('drops the separator when no reason was given', () => {
  assert.equal(away.formatAwayHeadline('', '14:30'), '14:30에 자리 비움');
  assert.equal(away.formatAwayHeadline('   ', '09:05'), '09:05에 자리 비움');
});

test('sends the ready-made headline to the overlay', () => {
  const now = Date.parse('2026-09-01T04:00:00.000Z'); // KST 13:00
  const state = away.createAwayCountdown({
    message: '🏥 병원',
    departureTime: '15:00',
    travelMinutes: 40,
    now,
  });
  assert.equal(
    away.awayOverlaySnapshot(state, now).headline,
    '13:20에 자리 비움 | 🏥 병원',
  );
});

test('keeps a sub-hour countdown in plain minutes', () => {
  assert.equal(typeof away.formatRemaining, 'function');
  assert.equal(away.formatRemaining(23), '23분');
  assert.equal(away.formatRemaining(59), '59분');
  assert.equal(away.formatRemaining(0), '0분');
});

test('splits an hour or more into hours and minutes', () => {
  assert.equal(away.formatRemaining(61), '1시간 1분');
  assert.equal(away.formatRemaining(899), '14시간 59분');
});

test('drops the minutes on a whole number of hours', () => {
  assert.equal(away.formatRemaining(60), '1시간');
  assert.equal(away.formatRemaining(120), '2시간');
});

test('builds the stored countdown from a command', () => {
  assert.equal(typeof away.createAwayCountdown, 'function');
  const now = Date.parse('2026-09-01T04:00:00.000Z'); // KST 13:00
  assert.deepEqual(
    away.createAwayCountdown({
      message: '🏥 병원',
      departureTime: '15:00',
      travelMinutes: 40,
      userId: 'u1',
      now,
    }),
    {
      message: '🏥 병원',
      departureTime: '15:00',
      travelMinutes: 40,
      prepMinutes: 60,
      arriveAt: Date.parse('2026-09-01T06:00:00.000Z'),
      departAt: Date.parse('2026-09-01T05:20:00.000Z'),
      targetAt: Date.parse('2026-09-01T04:20:00.000Z'),
      createdAt: now,
      createdBy: 'u1',
    },
  );
});

test('stores an empty reason rather than undefined', () => {
  const built = away.createAwayCountdown({ departureTime: '09:05', userId: 'u1' });
  assert.equal(built.message, '');
});
