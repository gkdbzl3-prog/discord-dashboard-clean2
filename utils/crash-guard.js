// utils/crash-guard.js
//
// 2026-09-04, Fly 227에서 Discord 게이트웨이 웹소켓의 ECONNRESET가
// 아무 데서도 잡히지 않아 프로세스가 통째로 exit 1 로 죽었다.
//   Error: read ECONNRESET
//     at ClientRequest.<anonymous> (/app/node_modules/ws/lib/websocket.js:886:5)
//     host: 'gateway-us-east1-c.discord.gg'
// 게이트웨이가 끊기는 건 정상 운영 중에도 일어나는 일이고 discord.js가 알아서
// 재연결한다. 그런 일시적 네트워크 오류로 봇 전체가 내려가면 안 된다.
//
// 반대로 진짜 버그(TypeError 등)까지 삼켜 버리면 망가진 상태로 계속 도는 게 더
// 위험하므로, 회복 가능한 네트워크 오류만 통과시키고 나머지는 그대로 죽인다.

const RECOVERABLE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'EPIPE',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET'
]);

function isRecoverableNetworkError(err) {
  if (!err) return false;

  if (RECOVERABLE_CODES.has(String(err.code || ''))) return true;

  // discord.js / ws 는 code 없이 메시지만 남기는 경우가 있다.
  const message = String(err.message || '');
  return /\b(ECONNRESET|EPIPE|ETIMEDOUT|socket hang up|network error)\b/i.test(message);
}

function installCrashGuard({
  onProcess = process,
  log = console.error,
  exit = (code) => process.exit(code)
} = {}) {
  onProcess.on('uncaughtException', (err) => {
    if (isRecoverableNetworkError(err)) {
      log('[crash-guard] 회복 가능한 네트워크 오류 무시:', err.code || err.message);
      return;
    }

    log('[crash-guard] 처리되지 않은 예외로 종료합니다:', err);
    exit(1);
  });

  onProcess.on('unhandledRejection', (reason) => {
    if (isRecoverableNetworkError(reason)) {
      log('[crash-guard] 회복 가능한 네트워크 거부 무시:', reason.code || reason.message);
      return;
    }

    // rejection 은 예외보다 사소한 경우가 많아 죽이지 않고 남기기만 한다.
    log('[crash-guard] 처리되지 않은 rejection:', reason);
  });
}

module.exports = { isRecoverableNetworkError, installCrashGuard };
