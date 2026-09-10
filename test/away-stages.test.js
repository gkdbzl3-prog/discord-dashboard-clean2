const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createAwayCountdown, awayOverlaySnapshot, awayOverlayReply } = require('../away-countdown');
const { parseObsInput } = require('../obs-chat-command');
const at = (clock) => Date.parse(`2026-09-09T${clock}:00+09:00`);
function payload() {
  return awayOverlaySnapshot(createAwayCountdown({ ...parseObsInput('14:00 1시간 병원'), now: at('11:00') }), at('12:00'));
}
function page(mode) {
  const nodes = {};
  const node = () => ({ textContent: '', append() {}, replaceChildren() {} });
  const document = {
    documentElement: { dataset: { mode }, setAttribute() {}, removeAttribute() {} },
    getElementById(id) { return nodes[id] ||= node(); },
    createElement: node,
  };
  const html = fs.readFileSync(require.resolve('../public/away_overlay.html'), 'utf8');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  const context = vm.createContext({ window: { addEventListener() {} }, document, location: { search: '', protocol: 'http:' }, URLSearchParams, setInterval() {}, fetch: () => new Promise(() => {}) });
  vm.runInContext(script, context);
  return {
    render(p, now) { context.renderAway(p, now); return nodes; },
    rows(p) { return JSON.parse(JSON.stringify(context.scheduleRows(p))); },
  };
}
test('14:00 1시간 병원 leaves the desk at 12:00, departs at 13:00 and counts down to the appointment', () => {
  const p = payload();
  assert.equal(p.awayTime, '12:00');
  assert.equal(p.departTime, '13:00');
  assert.equal(p.arriveTime, '14:00');
  assert.equal(p.minutesRemaining, 120);
  assert.equal(p.targetAt, at('14:00'));
  const state = createAwayCountdown({ ...parseObsInput('14:00 1시간 병원'), now: at('11:00') });
  assert.equal(awayOverlayReply(state, at('12:00')), '12:00에 자리 비움 | 병원 120분 남음');
});
test('desktop changes guidance at exact prepare, departure and appointment boundaries', () => {
  const ui = page('desktop');
  const p = payload();
  assert.equal(ui.render(p, at('12:00') - 1).stage.textContent, '');
  assert.equal(ui.render(p, at('12:00')).stage.textContent, '슬슬 준비해');
  assert.equal(ui.render(p, at('13:00') - 1).stage.textContent, '슬슬 준비해');
  assert.equal(ui.render(p, at('13:00')).stage.textContent, '나가야 해');
  assert.equal(ui.render(p, at('14:00')).stage.textContent, '약속 시간이야');
  assert.equal(ui.render(p, at('14:01')).countdown.textContent, '0분 남음');
  assert.equal(ui.render(null, at('14:01')).stage.textContent, '');
});
test('OBS displays appointment minutes without desktop guidance', () => {
  const nodes = page('obs').render(payload(), at('12:00'));
  assert.equal(nodes.headline.textContent, '12:00에 자리 비움 | 병원');
  assert.equal(nodes.countdown.textContent, '120분 남음');
  assert.equal(nodes.stage.textContent, '');
});
test('desktop schedule lists prepare, departure and arrival with the countdown on the last row', () => {
  assert.deepEqual(page('desktop').rows(payload()), [
    { label: '자리 비움', clock: '12:00' },
    { label: '출발', clock: '13:00' },
    { label: '도착', clock: '14:00', target: true },
  ]);
});
test('desktop schedule folds a plan without travel time into two rows', () => {
  const p = awayOverlaySnapshot(createAwayCountdown({ ...parseObsInput('14:00 병원'), now: at('11:00') }), at('12:00'));
  assert.deepEqual(page('desktop').rows(p), [
    { label: '자리 비움', clock: '12:00' },
    { label: '출발', clock: '14:00', target: true },
  ]);
});
test('existing stored plans use their departure and appointment times', () => {
  const p = awayOverlaySnapshot({ message: '병원', targetAt: at('11:00'), departAt: at('13:00'), arriveAt: at('14:00') }, at('12:00'));
  assert.equal(p.awayTime, '12:00');
  assert.equal(p.departTime, '13:00');
  assert.equal(p.minutesRemaining, 120);
});
