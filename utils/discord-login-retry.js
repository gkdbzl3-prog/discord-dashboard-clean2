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

  const login = async () => {
    try {
      await client.login(token);
      logger.log('Discord bot logged in');
    } catch (error) {
      const resetAt = sessionResetAtFromError(error);
      if (!resetAt) {
        logger.error('Bot login failed:', error);
        return;
      }

      const delay = Math.max(RETRY_BUFFER_MS, resetAt - now() + RETRY_BUFFER_MS);
      logger.error(
        `Bot login session limit reached; retrying once at ${new Date(now() + delay).toISOString()}`
      );
      schedule(login, delay);
    }
  };

  void login();
}

module.exports = {
  RETRY_BUFFER_MS,
  loginDiscordWithSessionRetry,
  sessionResetAtFromError,
};
