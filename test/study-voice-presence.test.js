const assert = require('node:assert/strict');
const test = require('node:test');

let presence = {};
try {
  presence = require('../study-voice-presence');
} catch (_) {}

function membersOf(...bots) {
  return { filter: (fn) => ({ size: bots.filter((isBot) => fn({ user: { bot: isBot } })).length }) };
}

test('counts only the humans sitting in the channel', () => {
  assert.equal(typeof presence.countStudyChannelHumans, 'function');
  assert.equal(presence.countStudyChannelHumans({ members: membersOf(false, false, true) }), 2);
  assert.equal(presence.countStudyChannelHumans({ members: membersOf(true) }), 0);
  assert.equal(presence.countStudyChannelHumans(null), 0);
  assert.equal(presence.countStudyChannelHumans({}), 0);
});

test('sits in the channel while it would otherwise look empty', () => {
  assert.equal(typeof presence.decideStudyVcAction, 'function');
  assert.equal(presence.decideStudyVcAction({ humanCount: 0, connected: false }), 'join');
  assert.equal(presence.decideStudyVcAction({ humanCount: 1, connected: false }), 'join');
});

test('steps out once a second person shows up', () => {
  assert.equal(presence.decideStudyVcAction({ humanCount: 2, connected: true }), 'leave');
  assert.equal(presence.decideStudyVcAction({ humanCount: 9, connected: true }), 'leave');
});

test('does nothing when it is already where it belongs', () => {
  assert.equal(presence.decideStudyVcAction({ humanCount: 0, connected: true }), 'stay');
  assert.equal(presence.decideStudyVcAction({ humanCount: 1, connected: true }), 'stay');
  assert.equal(presence.decideStudyVcAction({ humanCount: 2, connected: false }), 'stay');
});
