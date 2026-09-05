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
    travelMinutes: 0,
    message: '🏥 병원',
  });
});

test('allows a bare departure time with no message', () => {
  assert.deepEqual(obs.parseObsChatCommand('!obs 14:30'), {
    action: 'set',
    departureTime: '14:30',
    travelMinutes: 0,
    message: '',
  });
});

test('tolerates surrounding and repeated whitespace', () => {
  assert.deepEqual(obs.parseObsChatCommand('  !obs   09:05    마트   가는   중  '), {
    action: 'set',
    departureTime: '09:05',
    travelMinutes: 0,
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

test('routes a DM to the guild the data marks as default', () => {
  assert.equal(typeof obs.resolveObsGuildId, 'function');
  const dataRoot = { meta: { defaultGuildId: 'g2' } };
  assert.equal(obs.resolveObsGuildId(dataRoot, {}, ['g1', 'g2', 'g3']), 'g2');
});

test('falls back to the configured guild env vars in order', () => {
  const guildIds = ['g1', 'g2', 'g3'];
  assert.equal(obs.resolveObsGuildId({}, { DEFAULT_GUILD_ID: 'g3' }, guildIds), 'g3');
  assert.equal(obs.resolveObsGuildId({}, { GUILD_ID: 'g1' }, guildIds), 'g1');
  assert.equal(
    obs.resolveObsGuildId({}, { DEFAULT_GUILD_ID: 'g3', GUILD_ID: 'g1' }, guildIds),
    'g3',
  );
});

test('skips configured guilds the bot is not actually in', () => {
  const dataRoot = { meta: { defaultGuildId: 'gone' } };
  assert.equal(obs.resolveObsGuildId(dataRoot, { GUILD_ID: 'g2' }, ['g1', 'g2']), 'g2');
});

test('uses the only guild when nothing is configured', () => {
  assert.equal(obs.resolveObsGuildId({}, {}, ['g1']), 'g1');
});

test('refuses to guess between several unconfigured guilds', () => {
  assert.equal(obs.resolveObsGuildId({}, {}, ['g1', 'g2']), null);
  assert.equal(obs.resolveObsGuildId({}, {}, []), null);
});

test('pulls the time out of a single free-form input', () => {
  assert.equal(typeof obs.parseObsInput, 'function');
  assert.deepEqual(obs.parseObsInput('09:20 🏥병원'), {
    action: 'set',
    departureTime: '09:20',
    travelMinutes: 0,
    message: '🏥병원',
  });
  assert.deepEqual(obs.parseObsInput('09:20'), {
    action: 'set',
    departureTime: '09:20',
    travelMinutes: 0,
    message: '',
  });
});

test('finds the time wherever it sits in the input', () => {
  assert.deepEqual(obs.parseObsInput('🏥병원 09:20'), {
    action: 'set',
    departureTime: '09:20',
    travelMinutes: 0,
    message: '🏥병원',
  });
  assert.deepEqual(obs.parseObsInput('오늘 14:30 치과 예약'), {
    action: 'set',
    departureTime: '14:30',
    travelMinutes: 0,
    message: '오늘 치과 예약',
  });
});

test('takes the first time when the reason mentions another one', () => {
  assert.deepEqual(obs.parseObsInput('14:30 회의 15:00까지'), {
    action: 'set',
    departureTime: '14:30',
    travelMinutes: 0,
    message: '회의 15:00까지',
  });
});

test('reads the travel time out of the same line', () => {
  assert.deepEqual(obs.parseObsInput('15:00 40분 병원'), {
    action: 'set',
    departureTime: '15:00',
    travelMinutes: 40,
    message: '병원',
  });
});

test('adds up a travel time written across two words', () => {
  assert.deepEqual(obs.parseObsInput('18:00 1시간 30분 본가'), {
    action: 'set',
    departureTime: '18:00',
    travelMinutes: 90,
    message: '본가',
  });
  assert.deepEqual(obs.parseObsInput('18:00 1시간30분 본가'), {
    action: 'set',
    departureTime: '18:00',
    travelMinutes: 90,
    message: '본가',
  });
});

test('leaves a bare number in the reason alone', () => {
  assert.deepEqual(obs.parseObsInput('15:00 병원 3층'), {
    action: 'set',
    departureTime: '15:00',
    travelMinutes: 0,
    message: '병원 3층',
  });
});

test('refuses an input with no time in it at all', () => {
  assert.deepEqual(obs.parseObsInput('🏥병원'), { action: 'invalid', reason: 'time' });
  assert.deepEqual(obs.parseObsInput(''), { action: 'invalid', reason: 'time' });
  assert.deepEqual(obs.parseObsInput('25:00 병원'), { action: 'invalid', reason: 'time' });
});

test('allows the obs chat command only in a DM or the log channel', () => {
  assert.equal(typeof obs.isObsChannelAllowed, 'function');
  assert.equal(obs.isObsChannelAllowed({ isDirectMessage: true, channelId: 'c9' }), true);
  assert.equal(
    obs.isObsChannelAllowed({ channelId: 'logs', logChannelId: 'logs' }),
    true,
  );
  assert.equal(
    obs.isObsChannelAllowed({ channelId: 'general', logChannelId: 'logs' }),
    false,
  );
});

test('keeps the obs chat command out of every channel when no log channel is set', () => {
  assert.equal(obs.isObsChannelAllowed({ channelId: 'general' }), false);
  assert.equal(obs.isObsChannelAllowed({ isDirectMessage: true }), true);
});

test('compares channel ids as strings', () => {
  assert.equal(obs.isObsChannelAllowed({ channelId: 123, logChannelId: '123' }), true);
});
