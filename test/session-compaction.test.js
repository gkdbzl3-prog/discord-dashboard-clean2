const test = require('node:test');
const assert = require('node:assert');
const {
  appendAutoSplitSession,
  compactAutoSplitSessions
} = require('../session-compaction');

const KST_NOON = Date.parse('2026-09-04T03:00:00.000Z'); // KST 12:00
const MIN = 60 * 1000;

const auto = (start, end) => ({
  start,
  end,
  seconds: Math.floor((end - start) / 1000),
  source: 'auto_split'
});

test('이어지는 tick 은 새 레코드를 만들지 않고 직전 블록을 늘린다', () => {
  const user = { currentStart: KST_NOON, sessions: [] };

  appendAutoSplitSession(user, KST_NOON + MIN);
  user.currentStart = KST_NOON + MIN;
  appendAutoSplitSession(user, KST_NOON + 2 * MIN);
  user.currentStart = KST_NOON + 2 * MIN;
  appendAutoSplitSession(user, KST_NOON + 3 * MIN);

  assert.strictEqual(user.sessions.length, 1);
  assert.deepStrictEqual(user.sessions[0], auto(KST_NOON, KST_NOON + 3 * MIN));
});

test('끊겼다 다시 시작하면 새 블록을 만든다', () => {
  const user = { currentStart: KST_NOON, sessions: [] };
  appendAutoSplitSession(user, KST_NOON + MIN);

  user.currentStart = KST_NOON + 30 * MIN; // 자리를 비웠다 돌아옴
  appendAutoSplitSession(user, KST_NOON + 31 * MIN);

  assert.strictEqual(user.sessions.length, 2);
  assert.strictEqual(user.sessions[0].start, KST_NOON + 30 * MIN);
});

test('KST 자정은 넘겨 합치지 않는다', () => {
  const beforeMidnight = Date.parse('2026-09-04T14:50:00.000Z'); // KST 23:50
  const user = { currentStart: beforeMidnight, sessions: [] };

  appendAutoSplitSession(user, beforeMidnight + 5 * MIN);  // KST 23:55
  user.currentStart = beforeMidnight + 5 * MIN;
  appendAutoSplitSession(user, beforeMidnight + 20 * MIN); // KST 00:10, 다음날

  assert.strictEqual(user.sessions.length, 2);
});

test('압축은 초 합계를 바꾸지 않는다', () => {
  const sessions = [
    auto(KST_NOON + 2 * MIN, KST_NOON + 3 * MIN),
    auto(KST_NOON + MIN, KST_NOON + 2 * MIN),
    auto(KST_NOON, KST_NOON + MIN)
  ];
  const before = sessions.reduce((s, x) => s + x.seconds, 0);

  const after = compactAutoSplitSessions(sessions);

  assert.strictEqual(after.length, 1);
  assert.strictEqual(after.reduce((s, x) => s + x.seconds, 0), before);
});

test('camera_event 와 manual 은 손대지 않는다', () => {
  const camera = { start: KST_NOON + 5 * MIN, end: KST_NOON + 6 * MIN, seconds: 60, source: 'camera_event' };
  const sessions = [
    camera,
    auto(KST_NOON + MIN, KST_NOON + 2 * MIN),
    auto(KST_NOON, KST_NOON + MIN)
  ];

  const after = compactAutoSplitSessions(sessions);

  assert.strictEqual(after.length, 2);
  assert.deepStrictEqual(after[0], camera);
  assert.deepStrictEqual(after[1], auto(KST_NOON, KST_NOON + 2 * MIN));
});

test('중간에 다른 source 가 끼면 그 경계에서 끊는다', () => {
  const sessions = [
    auto(KST_NOON + 3 * MIN, KST_NOON + 4 * MIN),
    { start: KST_NOON + 2 * MIN, end: KST_NOON + 3 * MIN, seconds: 60, source: 'camera_event' },
    auto(KST_NOON, KST_NOON + 2 * MIN)
  ];

  const after = compactAutoSplitSessions(sessions);

  assert.strictEqual(after.length, 3);
});

test('압축은 원본 배열을 건드리지 않는다', () => {
  const sessions = [
    auto(KST_NOON + MIN, KST_NOON + 2 * MIN),
    auto(KST_NOON, KST_NOON + MIN)
  ];

  compactAutoSplitSessions(sessions);

  assert.strictEqual(sessions.length, 2);
  assert.strictEqual(sessions[0].start, KST_NOON + MIN);
});

test('빈 배열과 잘못된 입력도 견딘다', () => {
  assert.deepStrictEqual(compactAutoSplitSessions([]), []);
  assert.deepStrictEqual(compactAutoSplitSessions(undefined), []);
});

test('압축은 조각마다 잘려나간 1초 미만을 되살리지 않는다', () => {
  // floor 때문에 30.9초짜리 조각이 30초로 적혀 있는 상황
  const a = { start: KST_NOON + 30900, end: KST_NOON + 61800, seconds: 30, source: 'auto_split' };
  const b = { start: KST_NOON, end: KST_NOON + 30900, seconds: 30, source: 'auto_split' };

  const after = compactAutoSplitSessions([a, b]);

  assert.strictEqual(after.length, 1);
  // 타임스탬프로 다시 계산하면 61초가 되지만, 기록된 값(30+30)을 지킨다
  assert.strictEqual(after[0].seconds, 60);
  assert.strictEqual(after[0].start, KST_NOON);
  assert.strictEqual(after[0].end, KST_NOON + 61800);
});

test('앞으로 쌓이는 블록은 시작 기준으로 계산해 잘림이 누적되지 않는다', () => {
  const user = { currentStart: KST_NOON, sessions: [] };

  appendAutoSplitSession(user, KST_NOON + 30900);
  user.currentStart = KST_NOON + 30900;
  appendAutoSplitSession(user, KST_NOON + 61800);

  assert.strictEqual(user.sessions.length, 1);
  assert.strictEqual(user.sessions[0].seconds, 61);
});
