const DEFAULT_GUILD_ID = String(
  process.env.DEFAULT_GUILD_ID ||
  process.env.GUILD_ID ||
  "default"
);

function createEmptyGuild() {
  return {
    users: {},
    feed: [],
    settings: {
      studyVcId: process.env.STUDY_VC_ID || null,
      logChannelId: process.env.LOG_CHANNEL_ID || null,
      periodNoticeChannelId: process.env.PERIOD_NOTICE_CHANNEL_ID || null
    }
  };
}

function ensureGuildShape(guild) {
  if (!guild || typeof guild !== "object") return createEmptyGuild();
  if (!guild.users || typeof guild.users !== "object") guild.users = {};
  if (!Array.isArray(guild.feed)) guild.feed = [];
  if (!guild.settings || typeof guild.settings !== "object") guild.settings = {};
  if (guild.settings.studyVcId === undefined) {
    guild.settings.studyVcId = process.env.STUDY_VC_ID || null;
  }
  if (guild.settings.logChannelId === undefined) {
    guild.settings.logChannelId = process.env.LOG_CHANNEL_ID || null;
  }
  if (guild.settings.periodNoticeChannelId === undefined) {
    guild.settings.periodNoticeChannelId = process.env.PERIOD_NOTICE_CHANNEL_ID || null;
  }
  return guild;
}

function normalizeDataRoot(rawData) {
  const data = rawData && typeof rawData === "object" ? rawData : {};

  if (!data.guilds || typeof data.guilds !== "object" || Array.isArray(data.guilds)) {
    const legacyUsers =
      data.users && typeof data.users === "object" && !Array.isArray(data.users)
        ? data.users
        : {};
    const legacyFeed = Array.isArray(data.feed) ? data.feed : [];
    const legacySettings =
      data.settings && typeof data.settings === "object" && !Array.isArray(data.settings)
        ? data.settings
        : {};

    data.guilds = {
      [DEFAULT_GUILD_ID]: ensureGuildShape({
        users: legacyUsers,
        feed: legacyFeed,
        settings: {
          studyVcId: legacySettings.studyVcId || process.env.STUDY_VC_ID || null,
          logChannelId: legacySettings.logChannelId || process.env.LOG_CHANNEL_ID || null,
          periodNoticeChannelId:
            legacySettings.periodNoticeChannelId ||
            process.env.PERIOD_NOTICE_CHANNEL_ID ||
            null
        }
      })
    };
  }

  Object.keys(data.guilds).forEach((guildId) => {
    data.guilds[guildId] = ensureGuildShape(data.guilds[guildId]);
  });

  if (!data.meta || typeof data.meta !== "object") data.meta = {};
  if (!data.meta.defaultGuildId) data.meta.defaultGuildId = DEFAULT_GUILD_ID;
  const guildIds = Object.keys(data.guilds || {});
  const hasExplicitDefault = guildIds.includes(String(data.meta.defaultGuildId || ""));
  if (!hasExplicitDefault || (data.meta.defaultGuildId === "default" && guildIds.some((id) => id !== "default"))) {
    const preferred = guildIds.find((id) => id !== "default") || guildIds[0] || DEFAULT_GUILD_ID;
    data.meta.defaultGuildId = preferred;
  }

  delete data.users;
  delete data.feed;
  delete data.settings;

  return data;
}

function resolveGuildIdFromRequest(req, data) {
  const fromReq =
    req?.query?.guildId ||
    req?.body?.guildId ||
    req?.headers?.["x-guild-id"] ||
    req?.headers?.["x-guildid"];
  const guildId = String(fromReq || "").trim();
  if (guildId) return guildId;

  const ids = Object.keys(data?.guilds || {});
  const defaultId = String(data?.meta?.defaultGuildId || DEFAULT_GUILD_ID).trim();
  if (defaultId && ids.includes(defaultId)) return defaultId;

  const nonPlaceholder = ids.find((id) => id !== "default");
  if (nonPlaceholder) return nonPlaceholder;
  return ids[0] || DEFAULT_GUILD_ID;
}

function ensureGuild(data, guildId) {
  const safeId = String(guildId || DEFAULT_GUILD_ID);
  if (!data.guilds || typeof data.guilds !== "object") data.guilds = {};
  if (!data.guilds[safeId]) data.guilds[safeId] = createEmptyGuild();
  data.guilds[safeId] = ensureGuildShape(data.guilds[safeId]);
  return data.guilds[safeId];
}

function listGuilds(data) {
  return Object.entries(data?.guilds || {}).map(([guildId, guild]) => ({
    guildId,
    userCount: Object.keys(guild?.users || {}).length,
    feedCount: Array.isArray(guild?.feed) ? guild.feed.length : 0
  }));
}

module.exports = {
  DEFAULT_GUILD_ID,
  normalizeDataRoot,
  resolveGuildIdFromRequest,
  ensureGuild,
  listGuilds
};
