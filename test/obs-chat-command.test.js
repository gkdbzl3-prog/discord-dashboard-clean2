const assert = require('node:assert/strict');
const test = require('node:test');

let obs = {};
try {
  obs = require('../obs-chat-command');
} catch (_) {}

test('ignores messages that are not the !obs command', () => {
  assert.equal(typeof obs.parseObsChatCommand, 'function');
  assert.equal(obs.parseObsChatCommand('!time'), null);
  assert.equal(obs.parseObsChatCommand('안녕하세요'), null);
  assert.equal(obs.parseObsChatCommand('!obsessed 14:30'), null);
  assert.equal(obs.parseObsChatCommand(''), null);
});

test('reads the departure time and the message after it', () => {
  assert.deepEqual(obs.parseObsChatCommand('!obs 14:30 🏥 병원'), {
    action: 'set',
    departureTime: '14:30',
    message: '🏥 병원',
  });
});

test('allows a bare departure time with no message', () => {
  assert.deepEqual(obs.parseObsChatCommand('!obs 14:30'), {
    action: 'set',
    departureTime: '14:30',
    message: '',
  });
});

test('tolerates surrounding and repeated whitespace', () => {
  assert.deepEqual(obs.parseObsChatCommand('  !obs   09:05    마트   가는   중  '), {
    action: 'set',
    departureTime: '09:05',
    message: '마트 가는 중',
  });
});

test('clears the overlay for every off spelling', () => {
  for (const content of ['!obs끄기', '!obs 끄기', '!obs off', '!OBS 끄기']) {
    assert.deepEqual(obs.parseObsChatCommand(content), { action: 'clear' }, content);
  }
});

test('reports a bad departure time instead of setting the overlay', () => {
  assert.deepEqual(obs.parseObsChatCommand('!obs 25:00 병원'), {
    action: 'invalid',
    reason: 'time',
  });
  assert.deepEqual(obs.parseObsChatCommand('!obs 병원'), {
    action: 'invalid',
    reason: 'time',
  });
  assert.deepEqual(obs.parseObsChatCommand('!obs'), {
    action: 'invalid',
    reason: 'time',
  });
});

test('rejects a message longer than the overlay limit', () => {
  const tooLong = 'ㄱ'.repeat(101);
  assert.deepEqual(obs.parseObsChatCommand(`!obs 14:30 ${tooLong}`), {
    action: 'invalid',
    reason: 'too-long',
  });
  assert.equal(obs.parseObsChatCommand(`!obs 14:30 ${'ㄱ'.repeat(100)}`).action, 'set');
});
