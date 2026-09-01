const fs = require('node:fs');

const RETRY_BUFFER_MS = 5_000;

function sessionResetAtFromError(error) {
  const message = String(error?.message || error || '');
  const match = message.match(/resets at (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/i);
  if (!match) return null;

  const resetAt = Date.parse(match[1]);
  return Number.isFinite(resetAt) ? resetAt : null;
}

function loginDiscordWithSessionRetry(client, token, options = {}) {
  const now = options.now || Date.now;
  const schedule = options.setTimeout || setTimeout;
  const logger = options.logger || console;
  const lockFile = options.lockFile || null;

  const readLockedResetAt = () => {
    if (!lockFile) return null;
    try {
      const resetAt = Number(JSON.parse(fs.readFileSync(lockFile, 'utf8'))?.resetAt || 0);
      if (Number.isFinite(resetAt) && resetAt > now()) return resetAt;
      fs.unlinkSync(lockFile);
    } catch (_) {}
    return null;
  };

  const saveLockedResetAt = (resetAt) => {
    if (!lockFile) return;
    try {
      fs.writeFileSync(lockFile, JSON.stringify({ resetAt }), 'utf8');
    } catch (error) {
      logger.error('Failed to persist Discord session reset:', error);
    }
  };

  const clearLock = () => {
    if (!lockFile) return;
    try { fs.unlinkSync(lockFile); } catch (_) {}
  };

  const login = async (isRetry = false) => {
    try {
      await client.login(token);
      clearLock();
      logger.log('Discord bot logged in');
    } catch (error) {
      const resetAt = sessionResetAtFromError(error);
      if (!resetAt) {
        logger.error('Bot login failed:', error);
        return;
      }

      if (isRetry) {
        logger.error('Bot login retry failed; no further automatic login attempts:', error);
        return;
      }

      saveLockedResetAt(resetAt);
      const delay = Math.max(RETRY_BUFFER_MS, resetAt - now() + RETRY_BUFFER_MS);
      logger.error(
        `Bot login session limit reached; retrying once at ${new Date(now() + delay).toISOString()}`
      );
      schedule(() => login(true), delay);
    }
  };

  const lockedResetAt = readLockedResetAt();
  if (lockedResetAt) {
    const delay = lockedResetAt - now() + RETRY_BUFFER_MS;
    logger.error(
      `Discord session limit lock active; retrying once at ${new Date(now() + delay).toISOString()}`
    );
    schedule(() => login(true), delay);
    return;
  }

  void login();
}

module.exports = {
  RETRY_BUFFER_MS,
  loginDiscordWithSessionRetry,
  sessionResetAtFromError,
};
