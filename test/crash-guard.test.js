const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { isRecoverableNetworkError, installCrashGuard } = require('../utils/crash-guard');

test('게이트웨이 ECONNRESET 는 회복 가능한 오류로 본다', () => {
  const err = Object.assign(new Error('read ECONNRESET'), {
    code: 'ECONNRESET',
    host: 'gateway-us-east1-c.discord.gg'
  });

  assert.strictEqual(isRecoverableNetworkError(err), true);
});

test('code 없이 메시지만 있어도 socket hang up 은 회복 가능', () => {
  assert.strictEqual(isRecoverableNetworkError(new Error('socket hang up')), true);
});

test('진짜 버그(TypeError)는 회복 대상이 아니다', () => {
  assert.strictEqual(isRecoverableNetworkError(new TypeError('x is not a function')), false);
});

test('ECONNRESET 예외가 나도 프로세스를 종료하지 않는다', () => {
  const fake = new EventEmitter();
  const exits = [];
  installCrashGuard({ onProcess: fake, log: () => {}, exit: (c) => exits.push(c) });

  fake.emit('uncaughtException', Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }));

  assert.deepStrictEqual(exits, []);
});

test('네트워크와 무관한 예외는 종료시킨다', () => {
  const fake = new EventEmitter();
  const exits = [];
  installCrashGuard({ onProcess: fake, log: () => {}, exit: (c) => exits.push(c) });

  fake.emit('uncaughtException', new TypeError('boom'));

  assert.deepStrictEqual(exits, [1]);
});

test('unhandledRejection 은 어떤 경우에도 종료시키지 않는다', () => {
  const fake = new EventEmitter();
  const exits = [];
  installCrashGuard({ onProcess: fake, log: () => {}, exit: (c) => exits.push(c) });

  fake.emit('unhandledRejection', new TypeError('boom'));

  assert.deepStrictEqual(exits, []);
});
