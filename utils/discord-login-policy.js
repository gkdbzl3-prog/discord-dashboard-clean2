function isTruthyEnv(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function shouldLoginDiscordClient(env = process.env) {
  const token = String(env.DISCORD_TOKEN || env.BOT_TOKEN || "").trim();
  if (!token) {
    return { ok: false, reason: "missing-token" };
  }

  if (!env.FLY_APP_NAME && !isTruthyEnv(env.ENABLE_LOCAL_DISCORD_LOGIN)) {
    return { ok: false, reason: "local-discord-login-disabled" };
  }

  return { ok: true, reason: "enabled" };
}

module.exports = {
  shouldLoginDiscordClient,
};
