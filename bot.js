require("dotenv").config({ override: true });
const express = require("express");
const app = express();
const PORT = process.env.PORT || 8080;
const {
  ApplicationCommandOptionType,
  Client,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits
} = require('discord.js');
const createAdminRouter = require('./routes/admin');
const { loadData, saveData, DATA_FILE } = require('./data/store');
const { ensureGuild, normalizeDataRoot } = require('./data/guild-data');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { shouldLoginDiscordClient } = require("./utils/discord-login-policy");
const {
  buildAwayStatus,
  clearAwayReservation,
  executeAwayShortcut,
  getAwayReservationPhase,
  parseKstAwayEndAt,
  saveAwayReservation,
  setVoiceChannelStatus
} = require("./utils/away-status");
let data = loadData();
const DISCORD_LOGIN_TOKEN = String(
  process.env.DISCORD_TOKEN ||
  process.env.BOT_TOKEN ||
  ""
).trim();
const DISCORD_LOGIN_LOCK_FILE = `${DATA_FILE}.discord-login-lock.json`;
const ERROR_REPORT_QUEUE_FILE = `${DATA_FILE}.error-report-queue.json`;
const AUTO_SPLIT_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.AUTO_SPLIT_INTERVAL_MS || 5 * 60_000)
);
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require("@discordjs/voice");

app.use(express.static("public", {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
    } else if (filePath.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    } else if (filePath.endsWith(".css")) {
      res.setHeader("Content-Type", "text/css; charset=utf-8");
    }
  }
}));

app.get("/", (req, res) => {
  res.send("dashboard running");
});

app.get('/favicon.ico', (req, res) => res.status(204));

app.use(express.json());


const uploadDir = path.join(__dirname, "public", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});




app.listen(PORT, () => {
  console.log(`웹 서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log("봇이 시작되었습니다");
});




const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    // DirectMessages intent는 DM messageCreate 수신에 필요
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.GuildMember,
    // ⚠️ [FIX] DM 채널 파셜 추가 — DM 상호작용을 안정적으로 수신하기 위해 필요
    Partials.Channel
  ]
});

const ERROR_REPORT_TARGET_ID = String(
  process.env.ERROR_REPORT_USER_ID ||
  process.env.ERROR_REPORT_TARGET_ID ||
  ""
).trim();
const ERROR_REPORT_DEDUPE_MS = 60 * 1000;
const ERROR_REPORT_MAX_LEN = 1500;
const __nativeConsoleError = console.error.bind(console);
let __errorReportQueue = [];
let __errorReportFlushBusy = false;
let __errorReportDestinationPromise = null;
let __errorReportHookInstalled = false;
const __errorReportRecent = new Map();

function loadPersistedErrorReports() {
  try {
    const parsed = JSON.parse(fs.readFileSync(ERROR_REPORT_QUEUE_FILE, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.text === "string")
      .slice(-50);
  } catch (_) {
    return [];
  }
}

function savePersistedErrorReports(queue = __errorReportQueue) {
  const items = Array.isArray(queue) ? queue.slice(-50) : [];

  try {
    if (!items.length) {
      fs.unlinkSync(ERROR_REPORT_QUEUE_FILE);
      return;
    }

    fs.writeFileSync(ERROR_REPORT_QUEUE_FILE, JSON.stringify(items, null, 2), "utf8");
  } catch (err) {
    if (err?.code === "ENOENT" && !items.length) return;
    __nativeConsoleError("[error-report] persist failed:", err?.message || err);
  }
}

function hydrateErrorReportQueue() {
  const persisted = loadPersistedErrorReports();
  if (!persisted.length) return;
  __errorReportQueue.push(...persisted);
}

function stringifyErrorReportPart(value) {
  if (value instanceof Error) {
    return String(value.stack || `${value.name}: ${value.message}`);
  }
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value);
  }
}

function truncateErrorReportText(text, maxLen = ERROR_REPORT_MAX_LEN) {
  const normalized = String(text || "").replace(/```/g, "'''");
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen)}\n...[truncated]`;
}

function rememberRecentErrorReport(signature) {
  const now = Date.now();
  const prev = Number(__errorReportRecent.get(signature) || 0);

  for (const [key, ts] of __errorReportRecent.entries()) {
    if (now - Number(ts || 0) > ERROR_REPORT_DEDUPE_MS) {
      __errorReportRecent.delete(key);
    }
  }

  __errorReportRecent.set(signature, now);
  return prev > 0 && now - prev < ERROR_REPORT_DEDUPE_MS;
}

function buildErrorReportMessage(item) {
  const ts = new Date(item.createdAt).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false
  });
  const scope = process.env.FLY_APP_NAME || "local";
  return [
    "🚨 봇 에러 알림",
    `시간: ${ts} KST`,
    `앱: ${scope} / pid ${process.pid}`,
    "```txt",
    truncateErrorReportText(item.text),
    "```"
  ].join("\n");
}

async function resolveErrorReportTarget() {
  if (!ERROR_REPORT_TARGET_ID) return null;
  if (__errorReportDestinationPromise) return __errorReportDestinationPromise;

  __errorReportDestinationPromise = (async () => {
    try {
      const user = await client.users.fetch(ERROR_REPORT_TARGET_ID).catch(() => null);
      if (user && typeof user.send === "function") return user;
    } catch (err) {
      __nativeConsoleError("[error-report] target resolve failed:", err?.message || err);
    }

    return null;
  })();

  return __errorReportDestinationPromise;
}

async function flushErrorReportQueue() {
  if (__errorReportFlushBusy) return;
  if (!client?.isReady?.()) return;
  if (!__errorReportQueue.length) return;

  __errorReportFlushBusy = true;

  try {
    const target = await resolveErrorReportTarget();
    if (!target) return;

    while (__errorReportQueue.length > 0) {
      const item = __errorReportQueue[0];
      if (!item) {
        __errorReportQueue.shift();
        savePersistedErrorReports();
        continue;
      }
      try {
        await target.send(buildErrorReportMessage(item));
        __errorReportQueue.shift();
        savePersistedErrorReports();
      } catch (err) {
        __nativeConsoleError("[error-report] send failed:", err?.message || err);
        break;
      }
    }
  } finally {
    __errorReportFlushBusy = false;
  }
}

function queueErrorReport(level, args) {
  if (!ERROR_REPORT_TARGET_ID) return;
  const text = args.map((part) => stringifyErrorReportPart(part)).join(" ");
  const signature = `${level}:${text}`;
  if (rememberRecentErrorReport(signature)) return;

  __errorReportQueue.push({
    level,
    text,
    createdAt: Date.now()
  });
  savePersistedErrorReports();

  void flushErrorReportQueue();
}

function installErrorReportHook() {
  if (__errorReportHookInstalled) return;
  __errorReportHookInstalled = true;

  console.error = (...args) => {
    __nativeConsoleError(...args);
    queueErrorReport("error", args);
  };
}

hydrateErrorReportQueue();
installErrorReportHook();

let __gatewayRecoveryTimer = null;
let __gatewayRecoveryInFlight = false;
let __discordLoginTimer = null;
let __discordLoginInFlight = false;

function isTransientGatewayResetError(err) {
  if (!err || typeof err !== "object") return false;

  const code = String(err.code || "");
  const syscall = String(err.syscall || "");
  const stack = String(err.stack || "");

  if (code !== "ECONNRESET" || syscall !== "read") return false;

  return (
    stack.includes("\\ws\\lib\\websocket.js") ||
    stack.includes("/ws/lib/websocket.js") ||
    stack.includes("@discordjs/ws")
  );
}

function getDiscordSessionLimitResetAt(err) {
  const text = String(err?.stack || err?.message || err || "");
  if (!/Not enough sessions remaining/i.test(text)) return null;

  const match = text.match(/resets at ([0-9T:.\-]+Z)/i);
  if (!match) return null;

  const resetAt = Date.parse(match[1]);
  return Number.isFinite(resetAt) ? resetAt : null;
}

function formatKstDateTime(ms) {
  return new Date(ms).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false
  });
}

function getPersistedDiscordLoginResetAt() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DISCORD_LOGIN_LOCK_FILE, "utf8"));
    const resetAt = Number(parsed?.resetAt || 0);
    if (Number.isFinite(resetAt) && resetAt > Date.now()) return resetAt;
  } catch (_) {}

  return null;
}

function persistDiscordLoginResetAt(resetAt) {
  if (!Number.isFinite(resetAt) || resetAt <= Date.now()) return;

  try {
    fs.writeFileSync(
      DISCORD_LOGIN_LOCK_FILE,
      JSON.stringify({ resetAt, savedAt: Date.now() }, null, 2),
      "utf8"
    );
  } catch (err) {
    console.warn("[discord-login] failed to persist session limit lock:", err?.message || err);
  }
}

function clearPersistedDiscordLoginResetAt() {
  try {
    fs.unlinkSync(DISCORD_LOGIN_LOCK_FILE);
  } catch (_) {}
}

function scheduleDiscordLogin(source, delayMs = 0) {
  if (__discordLoginTimer || client?.isReady?.()) return;
  if (!DISCORD_LOGIN_TOKEN) return;

  const delay = Math.max(0, Number(delayMs || 0));
  if (delay > 0) {
    console.warn(`[discord-login:${source}] retry scheduled at ${formatKstDateTime(Date.now() + delay)} KST`);
  }

  __discordLoginTimer = setTimeout(async () => {
    __discordLoginTimer = null;
    await loginDiscordClient(source);
  }, delay);
}

async function loginDiscordClient(source = "startup") {
  if (__discordLoginInFlight || client?.isReady?.()) return false;
  if (!DISCORD_LOGIN_TOKEN) {
    console.error("Bot login skipped: missing DISCORD_TOKEN/BOT_TOKEN (.env not loaded)");
    return false;
  }

  const lockedUntil = getPersistedDiscordLoginResetAt();
  if (lockedUntil) {
    const retryDelay = Math.max(60 * 1000, lockedUntil - Date.now() + 5000);
    console.error(
      `[discord-login:${source}] persisted session limit lock active. ` +
      `${formatKstDateTime(lockedUntil)} KST 이후 재시도합니다.`
    );
    scheduleDiscordLogin(`${source}:persisted-session-limit`, retryDelay);
    return false;
  }

  __discordLoginInFlight = true;

  try {
    await client.login(DISCORD_LOGIN_TOKEN);
    clearPersistedDiscordLoginResetAt();
    console.log("Discord bot logged in");
    return true;
  } catch (err) {
    const resetAt = getDiscordSessionLimitResetAt(err);
    if (resetAt) {
      persistDiscordLoginResetAt(resetAt);
      const retryDelay = Math.max(60 * 1000, resetAt - Date.now() + 5000);
      console.error(
        `[discord-login:${source}] Discord 세션 시작 한도를 모두 사용했습니다. ` +
        `${formatKstDateTime(resetAt)} KST 이후 재시도합니다.`
      );
      scheduleDiscordLogin(`${source}:session-limit`, retryDelay);
      return false;
    }

    console.error("Bot login failed:", err);
    scheduleDiscordLogin(`${source}:retry`, 30_000);
    return false;
  } finally {
    __discordLoginInFlight = false;
  }
}

function scheduleGatewayRecovery(source, err) {
  if (__gatewayRecoveryInFlight || __gatewayRecoveryTimer) return;
  if (!DISCORD_LOGIN_TOKEN) {
    console.error(`[gateway-recover:${source}] skipped: missing DISCORD_TOKEN/BOT_TOKEN`);
    return;
  }

  __gatewayRecoveryInFlight = true;
  console.warn(`[gateway-recover:${source}] Discord gateway reconnect scheduled in 5s`);
  if (err) {
    console.warn(`[gateway-recover:${source}]`, err?.message || err);
  }

  __gatewayRecoveryTimer = setTimeout(async () => {
    __gatewayRecoveryTimer = null;

    try {
      if (client) {
        try {
          await client.destroy();
        } catch (_) {}
      }

      const loggedIn = await loginDiscordClient(`gateway-recover:${source}`);
      if (loggedIn) {
        console.log(`[gateway-recover:${source}] Discord gateway reconnected`);
      }
    } catch (loginErr) {
      console.error(`[gateway-recover:${source}] reconnect failed:`, loginErr);
    } finally {
      __gatewayRecoveryInFlight = false;
    }
  }, 5000);
}

// ⚠️ [FIX] error 핸들러는 ready 안이 아니라 최상위에 등록해야 함.
// ready 안에 있으면 ready 이벤트 전에 발생하는 에러를 잡지 못함.
client.on("error", err => {
  console.error("Discord Client Error:", err);
});
client.on("shardError", (err, shardId) => {
  console.error(`Discord shard error (shard ${shardId}):`, err);
});
client.on("shardDisconnect", (event, shardId) => {
  console.warn(
    `Discord shard disconnected (shard ${shardId}) code=${event?.code ?? "unknown"} clean=${event?.wasClean ?? false} reason=${event?.reason || "n/a"}`
  );
});
client.on("shardReconnecting", (shardId) => {
  console.warn(`Discord shard reconnecting (shard ${shardId})`);
});
client.on("shardResume", (shardId, replayedEvents) => {
  console.log(`Discord shard resumed (shard ${shardId}, replayed=${replayedEvents})`);
});
client.on("invalidated", () => {
  console.error("Discord session invalidated");
  scheduleGatewayRecovery("invalidated");
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);

  if (isTransientGatewayResetError(err)) {
    console.warn("Transient Discord gateway ECONNRESET detected; suppressing crash and attempting recovery");
    scheduleGatewayRecovery("uncaughtException", err);
    return;
  }

  console.error("Fatal uncaught exception. Exiting process.");
  setTimeout(() => process.exit(1), 50);
});

// Register admin routes after client is created
app.use('/', createAdminRouter(client));

let __studyVcConnection = null;

function getStudyChannelHumanCount(channel) {
  if (!channel?.members) return 0;
  return channel.members.filter(m => !m.user?.bot).size;
}

async function updateStudyChannelPresence() {
  const studyVcId = process.env.STUDY_VC_ID;
  if (!studyVcId) return;

  try {
    const channel = await client.channels.fetch(studyVcId);
    if (!channel?.guild) return;

    const humanCount = getStudyChannelHumanCount(channel);

    if (humanCount >= 2 && __studyVcConnection) {
      __studyVcConnection.destroy();
      __studyVcConnection = null;
      console.log("[voice] 2명 이상 접속 → 스터디 채널 퇴장");
      return;
    }

    if (humanCount < 2 && !__studyVcConnection) {
      __studyVcConnection = joinVoiceChannel({
        channelId: studyVcId,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: true,
      });

      __studyVcConnection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(__studyVcConnection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(__studyVcConnection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          __studyVcConnection.destroy();
          __studyVcConnection = null;
          setTimeout(() => updateStudyChannelPresence(), 5_000);
        }
      });

      console.log("[voice] 스터디 채널 상주 시작:", studyVcId);
    }
  } catch (err) {
    console.error("[voice] 스터디 채널 상태 업데이트 실패:", err?.message || err);
  }
}




function ensureUserExists(guildData, member) {
  if (!guildData.users) guildData.users = {};
  const userId = member.id;

  if (!guildData.users[userId]) {
    guildData.users[userId] = {
      id: userId,
      nickname: member.displayName || member.user.username,
      username: member.user.username,
      avatar: member.user.displayAvatarURL?.() || null,
      sessions: [],
      totalSeconds: 0,
      goalSec: 0,
      studyRecords: [],
      freeGoals: [],
      monthGoalHours: 40,
      currentStart: null,
      eventStart: null,
      cameraOn: false
    };

    console.log("🆕 신규 유저가 생성되었습니다:", userId);
  }

  if (guildData.users[userId].eventStart === undefined) {
    guildData.users[userId].eventStart = null;
  }
  if (guildData.users[userId].cameraOn === undefined) {
    guildData.users[userId].cameraOn = false;
  }
  if (guildData.users[userId].goalSec === undefined) {
    const h = Number(guildData.users[userId].monthGoalHours || 0);
    guildData.users[userId].goalSec = Number.isFinite(h) && h > 0 ? Math.floor(h * 3600) : 0;
  }

  return guildData.users[userId];
}

function withGuildDataById(dataRoot, guildId) {
  const data = normalizeDataRoot(dataRoot || {});
  const gid = String(guildId || process.env.DEFAULT_GUILD_ID || process.env.GUILD_ID || "default");
  const guild = ensureGuild(data, gid);
  return { data, guildId: gid, guild };
}

function secondsOfSession(s) {
  const direct = Number(s?.seconds || 0);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  const startMs = typeof s?.start === "number" ? s.start : Date.parse(s?.start);
  const endMs = typeof s?.end === "number" ? s.end : Date.parse(s?.end);
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
    return Math.floor((endMs - startMs) / 1000);
  }
  return 0;
}

function aggregateTotalByEventAndManual(user) {
  const sessions = Array.isArray(user?.sessions) ? user.sessions : [];
  const hasTagged = sessions.some((s) => typeof s?.source === "string");
  if (!hasTagged) {
    return sessions.reduce((sum, s) => sum + secondsOfSession(s), 0);
  }
  return sessions
    .filter((s) => s?.source === "camera_event" || s?.source === "manual" || s?.manual === true)
    .reduce((sum, s) => sum + secondsOfSession(s), 0);
}


let dirty = false;

function markDirty() {
  dirty = true;
}


// discord.js v14에서 'clientReady'는 정상 동작 (v15부터 공식 이벤트명)
client.on('clientReady', async () => {
  void flushErrorReportQueue();
  const STUDY_VC_ID = process.env.STUDY_VC_ID;
  const now = Date.now();
  data = normalizeDataRoot(loadData());

  Object.values(data.guilds || {}).forEach((g) => {
    Object.values(g?.users || {}).forEach((u) => {
      if (!u) return;
      u.currentStart = null;
      u.eventStart = null;
    });
  });

if (STUDY_VC_ID) {
  try {
    const channel = await client.channels.fetch(STUDY_VC_ID);
    if (channel?.guild?.id) {
      const { guild } = withGuildDataById(data, channel.guild.id);
      if (!guild.settings.studyVcId) guild.settings.studyVcId = STUDY_VC_ID;
      channel.members.forEach((member) => {
        if (member.user.bot) return;
        const user = ensureUserExists(guild, member);
        const cameraOrStreamOn = !!member.voice.selfVideo || !!member.voice.streaming;
        if (cameraOrStreamOn) {
          user.currentStart = now;
          user.eventStart = now;
          console.log("재시작 동기화 → 온라인 상태입니다:", member.user.username);
        }
      });
    }
  } catch (err) {
    console.error("clientReady study channel sync failed:", err?.message || err);
  }
}

   console.log("👾 봇 로그인이 완료되었습니다!");
  for (const guild of client.guilds.cache.values()) {
    await guild.members.fetch();
    const { guild: guildData } = withGuildDataById(data, guild.id);
    guild.members.cache.forEach((member) => {
      const user = ensureUserExists(guildData, member);
      user.avatar = member.user.displayAvatarURL?.() || null;
      user.nickname = member.displayName;
      user.username = member.user.username;
    });
    await ensureAwaySlashCommands(guild);
  }

  saveData(data);

  await updateStudyChannelPresence();
  await restoreAwayReservations();

});




// ===== Time Utilities =====

const DAY_MS = 24 * 60 * 60 * 1000;

function kstStartOfTodayMs(now) {
  const d = new Date(now);
  d.setHours(0,0,0,0);
  return d.getTime();
}

function overlapSeconds(start, end, rangeStart, rangeEnd) {
  const s = Math.max(start, rangeStart);
  const e = Math.min(end, rangeEnd);
  return Math.max(0, (e - s) / 1000);
}

function formatSeconds(sec) {
  if (!sec || sec <= 0) return "0m";

  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  let str = "";
  if (h) str += `${h}h `;
  if (m) str += `${m}m`;
  if (s && h === 0) str += `${s}s`;

  return str.trim();
}

function kstStartOfDayMs(now = Date.now()) {
  const d = new Date(now + KST_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - KST_OFFSET_MS;
}

function formatKstMonthDay(ms) {
  const d = new Date(ms + KST_OFFSET_MS);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${m}/${day}`;
}

function formatKstWeekday(ms) {
  const d = new Date(ms + KST_OFFSET_MS);
  return ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
}

function getCameraAcceptedSessions(user) {
  const sessions = Array.isArray(user?.sessions) ? user.sessions : [];
  const hasTagged = sessions.some((s) => typeof s?.source === "string");
  if (!hasTagged) return sessions;
  return sessions.filter((s) => s?.source === "camera_event");
}

function getCameraSecondsBetween(user, rangeStart, rangeEnd, now = Date.now()) {
  let total = 0;
  for (const s of getCameraAcceptedSessions(user)) {
    const start = typeof s?.start === "number" ? s.start : Date.parse(s?.start);
    const end = typeof s?.end === "number" ? s.end : Date.parse(s?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    total += overlapSeconds(start, end, rangeStart, rangeEnd);
  }

  const liveStart = Number(user?.eventStart || 0);
  if (Number.isFinite(liveStart) && liveStart > 0 && liveStart < now) {
    total += overlapSeconds(liveStart, now, rangeStart, rangeEnd);
  }

  return Math.max(0, Math.floor(total));
}

function buildWeeklyCameraBrief(user, now = Date.now(), dailyGoalHours = 10) {
  const todayStart = kstStartOfDayMs(now);
  const days = [];
  let totalSeconds = 0;
  let belowGoalCount = 0;
  const goalSec = Math.max(0, Math.floor(Number(dailyGoalHours || 0) * 3600));

  for (let offset = 6; offset >= 0; offset--) {
    const start = todayStart - offset * DAY_MS;
    const end = start + DAY_MS;
    const seconds = getCameraSecondsBetween(user, start, end, now);
    totalSeconds += seconds;
    const belowGoal = goalSec > 0 ? seconds < goalSec : false;
    if (belowGoal) belowGoalCount += 1;

    days.push({
      start,
      seconds,
      belowGoal
    });
  }

  return {
    totalSeconds,
    belowGoalCount,
    goalSec,
    days
  };
}

function parseGoalToSeconds(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "off" || raw === "0" || raw === "none") return 0;

  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*h/);
  const minMatch = raw.match(/(\d+(?:\.\d+)?)\s*m/);

  let seconds = 0;
  if (hourMatch) seconds += Math.round(Number(hourMatch[1]) * 3600);
  if (minMatch) seconds += Math.round(Number(minMatch[1]) * 60);

  if (!hourMatch && !minMatch && /^\d+(?:\.\d+)?$/.test(raw)) {
    seconds = Math.round(Number(raw) * 60);
  }

  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds;
}

function addCommandMemoRecord(user, memoText, now = Date.now()) {
  if (!user || !memoText) return;
  if (!Array.isArray(user.studyRecords)) user.studyRecords = [];

  user.studyRecords.unshift({
    id: now,
    type: "commandMemo",
    source: "discord_memo",
    subject: "메모",
    subjects: ["메모"],
    content: memoText,
    timestamp: now
  });
}

function computeTodayWeekAll(user) {

  const now = Date.now();
  const todayStart = kstStartOfTodayMs(now);

  const day = new Date(now + KST_OFFSET_MS).getUTCDay(); // 0=Sunday in KST
  const diff = (day + 2) % 7;
  const weekStart = todayStart - diff * DAY_MS;

  let todaysec = 0;
  let weekSec = 0;

  const sessions = Array.isArray(user?.sessions) ? user.sessions : [];
  const hasTagged = sessions.some((s) => typeof s?.source === "string");
  const accepted = hasTagged
    ? sessions.filter((s) => s?.source === "camera_event" || s?.source === "manual" || s?.manual === true)
    : sessions;

  for (const s of accepted) {
    const start = typeof s?.start === "number" ? s.start : Date.parse(s?.start);
    const end = typeof s?.end === "number" ? s.end : Date.parse(s?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    todaysec += overlapSeconds(start, end, todayStart, todayStart + DAY_MS);
    weekSec += overlapSeconds(start, end, weekStart, weekStart + (7 * DAY_MS));
  }

  const liveStart = Number(user?.eventStart || user?.currentStart || 0);
  let liveAll = 0;
  if (Number.isFinite(liveStart) && liveStart > 0 && liveStart < now) {
    todaysec += overlapSeconds(liveStart, now, todayStart, todayStart + DAY_MS);
    weekSec += overlapSeconds(liveStart, now, weekStart, weekStart + (7 * DAY_MS));
    liveAll = Math.floor((now - liveStart) / 1000);
  }

  const allSec = Math.max(0, Math.floor(Number(user?.totalSeconds || 0) + liveAll));

  return {
    todaysec: Math.floor(todaysec),
    weekSec: Math.floor(weekSec),
    allSec

  };

}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const PERIOD_END_SCHEDULE = [
  { key: "start", end: "09:00", message: "🔔등교완료!\n자리에 착석하셨나요?" },
  { key: "p1", end: "09:50", message: "🔔 1교시 종료" },
  { key: "p2", end: "11:40", message: "🔔 2교시 종료" },
  { key: "lunch", end: "13:00", message: "🔔 점심시간 종료" },
  { key: "p3", end: "14:40", message: "🔔 3교시 종료" },
  { key: "p4", end: "16:40", message: "🔔 4교시 종료" },
  { key: "p5", end: "17:50", message: "🔔 5교시 종료" },
  { key: "dinner", end: "19:00", message: "🔔 저녁시간 종료" },
  { key: "p6", end: "20:40", message: "🔔 6교시 종료" },
  { key: "p7", end: "22:40", message: "🔔7교시 종료 \n수고 많으셨습니다🙌 " }
];

const ENABLE_AWAY_PROMPT_DM = false;
const ENABLE_WEEKLY_CAMERA_BRIEF_DM = false;
const ENABLE_PERIOD_END_NOTICE = false;
const AWAY_PROMPT_INTERVAL_MS = 30 * 60 * 1000;
const CLASS_ACTIVE_WINDOWS = [
  { key: "p1", start: "09:00", end: "09:50" },
  { key: "p2", start: "10:00", end: "11:40" },
  { key: "p3", start: "13:00", end: "14:40" },
  { key: "p4", start: "15:00", end: "16:40" },
  { key: "p5", start: "17:00", end: "17:50" },
  { key: "p6", start: "19:00", end: "20:40" },
  { key: "p7", start: "21:00", end: "22:40" }
];
const AWAY_PROMPT_TARGETS = [
  {
    userId: "476226483703250956",
    displayName: "쫑",
    prompts: [
      "쫑님 어디 가셨나요~ 👀",
      "사라진 쫑님 찾습니다…\n출석체크 하러 왔어요 🙌",
      "쫑님 자리 비움 감지!\n지금쯤 다시 나타날 시간인데요?",
      "도망치신 건 아니죠? 👀",
      "쫑님… 설마 또 딴짓 중?",
      "잠깐 쉰 거지, 끝난 건 아니지? 😌",
      "의자와 재회할 시간입니다",
      "공부하러 돌아올 타이밍~!",
      "사라진 쫑님 찾습니다~ 👀",
      "뭐해? 지금 수업중이야! 📚",
      "오늘도 충분히 잘하고 있어, 조금만 더"
    ]
  },
  {
    userId: "1495274970564263966",
    displayName: "할수있다",
    prompts: [
      "할수있다님 어디 가셨나요~ 👀",
      "사라진 할수있다님 찾습니다…\n출석체크 하러 왔어요 🙌",
      "할수있다님 자리 비움 감지!\n지금쯤 다시 나타날 시간인데요?",
      "도망치신 건 아니죠? 👀",
      "할수있다님… 설마 또 딴짓 중?",
      "잠깐 쉰 거지, 끝난 건 아니지? 😌",
      "의자와 재회할 시간입니다",
      "공부하러 돌아올 타이밍~!",
      "사라진 할수있다님 찾습니다~ 👀",
      "뭐해? 지금 수업중이야! 📚",
      "오늘도 충분히 잘하고 있어, 조금만 더"
    ]
  }
];
const WEEKLY_BRIEF_TARGETS = [
  {
    userId: "1495274970564263966",
    displayName: "할수있다",
    dailyGoalHours: 10
  }
];

function resolvePeriodNoticeChannelId(guildData) {
  if (!ENABLE_PERIOD_END_NOTICE) return null;
  const configured = String(
    guildData?.settings?.periodNoticeChannelId ||
    process.env.PERIOD_NOTICE_CHANNEL_ID ||
    ""
  ).trim();
  return configured || null;
}

function isMissingOrInaccessibleDiscordChannelError(err) {
  const code = Number(err?.code || 0);
  const status = Number(err?.status || err?.httpStatus || 0);
  const message = String(err?.message || err?.rawError?.message || "");
  return (
    code === 10003 ||
    code === 50001 ||
    status === 404 ||
    /Unknown Channel|Missing Access/i.test(message)
  );
}

function disablePeriodNoticeChannel(channelId, reason = "missing_or_inaccessible") {
  const safeChannelId = String(channelId || "").trim();
  if (!safeChannelId) return false;

  const root = normalizeDataRoot(loadData());
  root.meta ??= {};
  root.meta.periodNoticeSentByChannel ??= {};
  root.meta.periodNoticeClaimByChannel ??= {};

  let changed = false;

  for (const guildId of Object.keys(root.guilds || {})) {
    const { guild } = withGuildDataById(root, guildId);
    if (String(guild?.settings?.periodNoticeChannelId || "").trim() === safeChannelId) {
      guild.settings.periodNoticeChannelId = null;
      changed = true;
    }
  }

  for (const key of Object.keys(root.meta.periodNoticeSentByChannel)) {
    if (key.startsWith(`${safeChannelId}:`)) {
      delete root.meta.periodNoticeSentByChannel[key];
      changed = true;
    }
  }

  for (const key of Object.keys(root.meta.periodNoticeClaimByChannel)) {
    if (key.startsWith(`${safeChannelId}:`)) {
      delete root.meta.periodNoticeClaimByChannel[key];
      changed = true;
    }
  }

  if (changed) {
    saveData(root);
    console.warn(`[period-notice] disabled channel ${safeChannelId} (${reason})`);
  }

  return changed;
}

async function resolvePeriodNoticeChannel(channelId) {
  let ch = client.channels.cache.get(channelId) || null;
  if (!ch) {
    ch = await client.channels.fetch(channelId);
  }
  if (!ch) return null;

  if (typeof ch.isThread === "function" && ch.isThread()) {
    if (ch.archived && typeof ch.setArchived === "function") {
      try {
        await ch.setArchived(false);
      } catch (_) {}
    }
    if (ch.joinable && typeof ch.join === "function") {
      try {
        await ch.join();
      } catch (_) {}
    }
  }

  return typeof ch.send === "function" ? ch : null;
}

function claimPeriodNoticeSlot(persistedKey, dateKey) {
  const claimToken = `${dateKey}:${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  const latestRoot = normalizeDataRoot(loadData());
  latestRoot.meta ??= {};
  latestRoot.meta.periodNoticeSentByChannel ??= {};
  latestRoot.meta.periodNoticeClaimByChannel ??= {};

  if (latestRoot.meta.periodNoticeSentByChannel[persistedKey] === dateKey) {
    return null;
  }

  latestRoot.meta.periodNoticeClaimByChannel[persistedKey] = claimToken;
  saveData(latestRoot);

  const confirmedRoot = normalizeDataRoot(loadData());
  const confirmedClaim = confirmedRoot?.meta?.periodNoticeClaimByChannel?.[persistedKey];
  const alreadySent = confirmedRoot?.meta?.periodNoticeSentByChannel?.[persistedKey] === dateKey;
  if (alreadySent || confirmedClaim !== claimToken) {
    return null;
  }

  return claimToken;
}

function releasePeriodNoticeSlot(persistedKey, claimToken) {
  const latestRoot = normalizeDataRoot(loadData());
  latestRoot.meta ??= {};
  latestRoot.meta.periodNoticeClaimByChannel ??= {};

  if (latestRoot.meta.periodNoticeClaimByChannel[persistedKey] === claimToken) {
    delete latestRoot.meta.periodNoticeClaimByChannel[persistedKey];
    saveData(latestRoot);
  }
}

function markPeriodNoticeSent(persistedKey, claimToken, dateKey) {
  const latestRoot = normalizeDataRoot(loadData());
  latestRoot.meta ??= {};
  latestRoot.meta.periodNoticeSentByChannel ??= {};
  latestRoot.meta.periodNoticeClaimByChannel ??= {};

  if (latestRoot.meta.periodNoticeClaimByChannel[persistedKey] === claimToken) {
    latestRoot.meta.periodNoticeSentByChannel[persistedKey] = dateKey;
    delete latestRoot.meta.periodNoticeClaimByChannel[persistedKey];
    saveData(latestRoot);
  }
}

function pickRandom(list = []) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

async function resolveStudyTextChannel(discordGuild, guildData) {
  const configuredId =
    guildData?.settings?.studyTextChannelId ||
    process.env.STUDY_TEXT_CHANNEL_ID ||
    null;

  let ch = null;
  if (configuredId) {
    ch = discordGuild.channels.cache.get(configuredId) || null;
    if (!ch) {
      try {
        ch = await discordGuild.channels.fetch(configuredId);
      } catch (_) {
        ch = null;
      }
    }
  }

  if (!ch) {
    ch = discordGuild.channels.cache.find((c) =>
      c && typeof c.name === "string" && c.name.includes("공부해요") && typeof c.send === "function"
    ) || null;
  }

  if (!ch || typeof ch.send !== "function" || !ch.messages) return null;
  return ch;
}

const awayStatusTimers = new Map();

const AWAY_COMMANDS = [
  {
    name: "away",
    description: "STUDY 음성채널에 자리 비움 상태를 설정합니다.",
    defaultMemberPermissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "시간",
        description: "복귀 예정 시각 (한국 시간, HH:MM)",
        required: true,
        minLength: 5,
        maxLength: 5
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "메시지",
        description: "예: 🏥 병원",
        required: false,
        maxLength: 450
      }
    ]
  },
  {
    name: "back",
    description: "STUDY 음성채널의 자리 비움 상태를 즉시 삭제합니다.",
    defaultMemberPermissions: PermissionFlagsBits.Administrator.toString()
  }
];

async function ensureAwaySlashCommands(discordGuild) {
  try {
    const commands = await discordGuild.commands.fetch();
    const cheer = commands.find((command) => command.name === "응원");
    if (cheer) await cheer.delete();

    for (const desired of AWAY_COMMANDS) {
      const existing = commands.find((command) => command.name === desired.name);
      if (existing) {
        await existing.edit(desired);
      } else {
        await discordGuild.commands.create(desired);
      }
    }
  } catch (err) {
    console.error("ensure /away and /back failed:", err?.message || err);
  }
}

async function resolveStudyVoiceChannel(guildId, preferredChannelId = null) {
  const root = normalizeDataRoot(loadData());
  const { guild } = withGuildDataById(root, guildId);
  const channelId =
    preferredChannelId || guild?.settings?.studyVcId || process.env.STUDY_VC_ID || null;
  if (!channelId) throw new Error("STUDY 음성채널이 설정되지 않았습니다.");

  const channel = await client.channels.fetch(channelId);
  if (!channel || typeof channel.isVoiceBased !== "function" || !channel.isVoiceBased()) {
    throw new Error("STUDY 음성채널을 찾을 수 없습니다.");
  }
  return channel;
}

function clearAwayTimer(guildId) {
  const key = String(guildId);
  const timer = awayStatusTimers.get(key);
  if (timer) clearTimeout(timer);
  awayStatusTimers.delete(key);
}

async function expireAwayReservation(guildId, expectedEndAt) {
  const root = normalizeDataRoot(loadData());
  const reservation = root?.meta?.awayReservations?.[guildId];
  if (!reservation || Number(reservation.endAt) !== Number(expectedEndAt)) return;

  try {
    const channel = await resolveStudyVoiceChannel(guildId, reservation.channelId);
    await setVoiceChannelStatus(client.rest, channel.id, null);
    clearAwayReservation(root, guildId);
    saveData(root);
    clearAwayTimer(guildId);
  } catch (err) {
    console.error("away status auto-clear failed:", err?.message || err);
    scheduleAwayExpiration(guildId, reservation, 60_000);
  }
}

function scheduleAwayExpiration(guildId, reservation, retryDelay = null) {
  clearAwayTimer(guildId);
  const delay = retryDelay ?? Math.max(0, Number(reservation.endAt) - Date.now());
  const timer = setTimeout(() => {
    void expireAwayReservation(String(guildId), reservation.endAt);
  }, delay);
  awayStatusTimers.set(String(guildId), timer);
}

function scheduleAwayActivation(guildId, reservation, retryDelay = null) {
  clearAwayTimer(guildId);
  const delay = retryDelay ?? Math.max(0, Number(reservation.startAt) - Date.now());
  const timer = setTimeout(() => {
    void activateScheduledAwayReservation(String(guildId), reservation.startAt);
  }, delay);
  awayStatusTimers.set(String(guildId), timer);
}

async function activateScheduledAwayReservation(guildId, expectedStartAt) {
  const root = normalizeDataRoot(loadData());
  const reservation = root?.meta?.awayReservations?.[guildId];
  const matchesStart = expectedStartAt == null
    ? reservation?.startAt == null
    : Number(reservation?.startAt) === Number(expectedStartAt);
  if (!reservation || !matchesStart) return;
  if (Number(reservation.endAt) <= Date.now()) {
    await expireAwayReservation(guildId, reservation.endAt);
    return;
  }

  try {
    const channel = await resolveStudyVoiceChannel(guildId, reservation.channelId);
    await setVoiceChannelStatus(client.rest, channel.id, reservation.status);
    scheduleAwayExpiration(guildId, reservation);
  } catch (err) {
    console.error("away status activation failed:", err?.message || err);
    scheduleAwayActivation(guildId, reservation, 60_000);
  }
}

async function restoreAwayReservations() {
  const root = normalizeDataRoot(loadData());
  for (const [guildId, reservation] of Object.entries(root?.meta?.awayReservations || {})) {
    const phase = getAwayReservationPhase(reservation);
    if (!reservation?.channelId || phase === "invalid") {
      clearAwayReservation(root, guildId);
      saveData(root);
      continue;
    }

    if (phase === "expired") {
      await expireAwayReservation(guildId, reservation.endAt);
      continue;
    }

    if (phase === "pending") {
      scheduleAwayActivation(guildId, reservation);
      continue;
    }

    await activateScheduledAwayReservation(guildId, reservation.startAt);
  }
}

let __weeklyBriefTickBusy = false;
const __weeklyBriefSent = new Set();
async function sendWeeklyCameraBriefTick() {
  if (__weeklyBriefTickBusy) return;
  __weeklyBriefTickBusy = true;

  try {
    if (!ENABLE_WEEKLY_CAMERA_BRIEF_DM) return;
    if (!client.isReady()) return;
    if (!process.env.FLY_APP_NAME) return;

    const now = Date.now();
    const { dateKey, hhmm } = getKstDateParts(now);
    const weekday = new Date(now + KST_OFFSET_MS).getUTCDay();
    if (weekday !== 5) return;
    if (hhmm !== "22:45") return;

    const root = normalizeDataRoot(loadData());
    root.meta ??= {};
    root.meta.weeklyCameraBriefSent ??= {};
    let changed = false;

    for (const discordGuild of client.guilds.cache.values()) {
      const guildId = discordGuild.id;
      const { guild } = withGuildDataById(root, guildId);

      for (const target of WEEKLY_BRIEF_TARGETS) {
        const onceKey = `${guildId}:${target.userId}:${dateKey}`;
        if (__weeklyBriefSent.has(onceKey)) continue;

        const persistedKey = `${guildId}:${target.userId}`;
        if (root.meta.weeklyCameraBriefSent[persistedKey] === dateKey) continue;

        const member =
          discordGuild.members.cache.get(target.userId) ||
          await discordGuild.members.fetch(target.userId).catch(() => null);
        if (!member || member.user?.bot) continue;

        const user = ensureUserExists(guild, member);
        const brief = buildWeeklyCameraBrief(user, now, target.dailyGoalHours);
        const dayLines = brief.days.map((day) => {
          const stamp = `${formatKstMonthDay(day.start)}(${formatKstWeekday(day.start)})`;
          const suffix = day.belowGoal ? " · 10시간 미달" : "";
          return `- ${stamp} ${formatSeconds(day.seconds)}${suffix}`;
        });

        const dmText =
          `📘 주간 캠 브리핑\n` +
          `${target.displayName}님 최근 7일 총 캠 활성화 시간은 ${formatSeconds(brief.totalSeconds)}였어요.\n` +
          `10시간 미달 일수: ${brief.belowGoalCount}회\n\n` +
          `${dayLines.join("\n")}`;

        try {
          await member.send(dmText);
          root.meta.weeklyCameraBriefSent[persistedKey] = dateKey;
          __weeklyBriefSent.add(onceKey);
          changed = true;
        } catch (err) {
          console.error("weekly camera brief failed:", err?.message || err);
        }
      }
    }

    if (changed) {
      saveData(root);
    }
  } catch (err) {
    console.error("weekly camera brief tick failed:", err?.message || err);
  } finally {
    __weeklyBriefTickBusy = false;
  }
}


function getKstDateParts(now = Date.now()) {
  const d = new Date(now + KST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return {
    dateKey: `${y}-${m}-${day}`,
    hhmm: `${hh}:${mm}`
  };
}

function hhmmToMinutes(hhmm) {
  const [hh, mm] = String(hhmm || "00:00").split(":").map(Number);
  return (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
}

function getCurrentClassWindow(now = Date.now()) {
  const { hhmm } = getKstDateParts(now);
  const minutes = hhmmToMinutes(hhmm);
  return CLASS_ACTIVE_WINDOWS.find((window) => {
    const start = hhmmToMinutes(window.start);
    const end = hhmmToMinutes(window.end);
    return minutes >= start && minutes < end;
  }) || null;
}

async function sendAwayPromptTick() {
  if (!ENABLE_AWAY_PROMPT_DM) return;
  if (!client.isReady()) return;
  if (!process.env.FLY_APP_NAME) return;

  const now = Date.now();
  const activeWindow = getCurrentClassWindow(now);
  const root = normalizeDataRoot(loadData());
  let changed = false;

  for (const discordGuild of client.guilds.cache.values()) {
    const { guild } = withGuildDataById(root, discordGuild.id);
    for (const target of AWAY_PROMPT_TARGETS) {
      const member =
        discordGuild.members.cache.get(target.userId) ||
        await discordGuild.members.fetch(target.userId).catch(() => null);

      if (!member || member.user?.bot) continue;

      const user = ensureUserExists(guild, member);
      const studyVcId = guild?.settings?.studyVcId || process.env.STUDY_VC_ID || null;
      const inStudy = studyVcId ? member.voice?.channelId === studyVcId : !!member.voice?.channelId;
      const camOrStreamOn = !!member.voice?.selfVideo || !!member.voice?.streaming;
      const activeNow = inStudy && camOrStreamOn;

      if (!activeWindow || activeNow) {
        if (user.awayPromptInactiveSince || user.lastAwayPromptAt || user.lastAwayPromptWindowKey) {
          user.awayPromptInactiveSince = null;
          user.lastAwayPromptAt = null;
          user.lastAwayPromptWindowKey = null;
          changed = true;
        }
        continue;
      }

      if (!user.awayPromptInactiveSince || user.lastAwayPromptWindowKey !== activeWindow.key) {
        user.awayPromptInactiveSince = now;
        user.lastAwayPromptAt = null;
        user.lastAwayPromptWindowKey = activeWindow.key;
        changed = true;
        continue;
      }

      const inactiveMs = now - Number(user.awayPromptInactiveSince || 0);
      if (inactiveMs < AWAY_PROMPT_INTERVAL_MS) continue;

      const lastPromptAt = Number(user.lastAwayPromptAt || 0);
      if (lastPromptAt > 0 && now - lastPromptAt < AWAY_PROMPT_INTERVAL_MS) continue;

      try {
        const dmText =
          target.prompts[Math.floor(Math.random() * target.prompts.length)];
        await member.send(dmText);
        user.lastAwayPromptAt = now;
        changed = true;
      } catch (err) {
        console.error("away prompt failed:", err?.message || err);
      }
    }
  }

  if (changed) {
    saveData(root);
  }
}

let __periodNoticeTickBusy = false;
const __periodNoticeSent = new Set();

async function sendPeriodEndNoticeTick() {
  if (__periodNoticeTickBusy) return;
  __periodNoticeTickBusy = true;

  try {
    if (!ENABLE_PERIOD_END_NOTICE) return;
    if (!client.isReady()) return;
    if (!process.env.FLY_APP_NAME) return; // 로컬 중복 전송 방지

    const { dateKey, hhmm } = getKstDateParts(Date.now());
    const hit = PERIOD_END_SCHEDULE.find((x) => x.end === hhmm);
    if (!hit) return;

    const root = normalizeDataRoot(loadData());
    root.meta ??= {};
    root.meta.periodNoticeSentByChannel ??= {};
    root.meta.periodNoticeClaimByChannel ??= {};
    const guildIds = Object.keys(root?.guilds || {});

    for (const guildId of guildIds) {
      const { guild } = withGuildDataById(root, guildId);
      const periodNoticeChannelId = resolvePeriodNoticeChannelId(guild);
      if (!periodNoticeChannelId) continue;

      // 같은 채널을 여러 guild 키(default/실제 guild)에서 참조해도 1번만 전송
      const onceKey = `${periodNoticeChannelId}:${dateKey}:${hit.key}`;
      if (__periodNoticeSent.has(onceKey)) continue;
      const persistedKey = `${periodNoticeChannelId}:${hit.key}`;
      if (root.meta.periodNoticeSentByChannel[persistedKey] === dateKey) continue;

      const claimToken = claimPeriodNoticeSlot(persistedKey, dateKey);
      if (!claimToken) continue;

      try {
        const ch = await resolvePeriodNoticeChannel(periodNoticeChannelId);
        if (!ch) {
          releasePeriodNoticeSlot(persistedKey, claimToken);
          continue;
        }

        await ch.send(hit.message);
        __periodNoticeSent.add(onceKey);
        root.meta.periodNoticeSentByChannel[persistedKey] = dateKey;
        markPeriodNoticeSent(persistedKey, claimToken, dateKey);
      } catch (err) {
        releasePeriodNoticeSlot(persistedKey, claimToken);
        if (isMissingOrInaccessibleDiscordChannelError(err)) {
          disablePeriodNoticeChannel(periodNoticeChannelId, err?.message || err?.code || "unknown");
          continue;
        }
        console.error("period notice send failed:", err?.message || err);
      }
    }

    // 메모리 누적 방지 (오늘 날짜 키만 유지)
    const keepPrefix = `:${dateKey}:`;
    for (const key of Array.from(__periodNoticeSent)) {
      if (!key.includes(keepPrefix)) __periodNoticeSent.delete(key);
    }
  } catch (err) {
    console.error("period notice tick failed:", err?.message || err);
  } finally {
    __periodNoticeTickBusy = false;
  }
}

let __liveStateReconciling = false;
async function reconcileLiveStates() {
  if (__liveStateReconciling) return;
  __liveStateReconciling = true;

  try {
    const root = normalizeDataRoot(loadData());
    const now = Date.now();
    let changed = false;

    for (const discordGuild of client.guilds.cache.values()) {
      const guildId = discordGuild.id;
      const { guild } = withGuildDataById(root, guildId);
      const studyVcId = guild?.settings?.studyVcId || process.env.STUDY_VC_ID || null;

      try {
        await discordGuild.members.fetch();
      } catch (_) {}

      discordGuild.members.cache.forEach((member) => {
        if (!member || member.user?.bot) return;
        const user = ensureUserExists(guild, member);

        const inAnyVoice = !!member.voice?.channelId;
        const camOn = !!member.voice?.selfVideo || !!member.voice?.streaming;
        const inStudy = studyVcId ? member.voice?.channelId === studyVcId : inAnyVoice;
        const cameraOnAnyVoice = inAnyVoice && camOn;

        if (user.cameraOn !== cameraOnAnyVoice) {
          user.cameraOn = cameraOnAnyVoice;
          changed = true;
        }

        if (inStudy && camOn) {
          if (!user.currentStart) {
            user.currentStart = now;
            changed = true;
          }
          if (!user.eventStart) {
            user.eventStart = user.currentStart;
            changed = true;
          }
          return;
        }

        if (user.currentStart || user.eventStart) {
          user.sessions ??= [];

          if (user.currentStart) {
            const tailDuration = Math.floor((now - user.currentStart) / 1000);
            if (tailDuration > 0) {
              user.sessions.unshift({
                start: user.currentStart,
                end: now,
                seconds: tailDuration,
                source: "auto_split"
              });
            }
          }

          if (user.eventStart) {
            const eventDuration = Math.floor((now - user.eventStart) / 1000);
            if (eventDuration > 0) {
              user.sessions.unshift({
                start: user.eventStart,
                end: now,
                seconds: eventDuration,
                source: "camera_event"
              });
            }
          }

          user.totalSeconds = aggregateTotalByEventAndManual(user);
          user.currentStart = null;
          user.eventStart = null;
          changed = true;
        }
      });
    }

    if (changed) {
      saveData(root);
    }
  } catch (err) {
    console.error("live reconcile failed:", err?.message || err);
  } finally {
    __liveStateReconciling = false;
  }
}


client.on("presenceUpdate", (oldPresence, newPresence) => {
  if (!newPresence || !newPresence.member) return;

  const member = newPresence.member;
  const guildId = member.guild?.id;
  if (!guildId) return;

  const root = normalizeDataRoot(loadData());
  const { data, guild } = withGuildDataById(root, guildId);
  const user = ensureUserExists(guild, member);

  // Keep latest profile fields in sync
  user.nickname = member.displayName || member.user.username;
  user.username = member.user.username;
  user.avatar = member.user.displayAvatarURL?.() || null;

  markDirty();
  saveData(data);
});



setInterval(() => {

  const data = normalizeDataRoot(loadData()); // reload latest data every tick
  const now = Date.now();
  let changed = false;

  for (const [guildId, guild] of Object.entries(data.guilds || {})) {
    for (const userId in (guild.users || {})) {
      const user = guild.users[userId];
      if (!user || !user.currentStart) continue;

      const duration = Math.floor((now - user.currentStart) / 1000);

      if (duration >= 30) {
        user.sessions ??= [];

        user.sessions.unshift({
          start: user.currentStart,
          end: now,
          seconds: duration,
          source: "auto_split"
        });

        user.totalSeconds = aggregateTotalByEventAndManual(user);
        user.currentStart = now;
        changed = true;
        console.log("✅ 자동 분할 저장 완료!", guildId, userId, duration);
      }
    }
  }

  if (changed) {
    saveData(data);
  }

}, AUTO_SPLIT_INTERVAL_MS);

setInterval(() => {
  reconcileLiveStates();
}, 60000);

setInterval(() => {
  sendPeriodEndNoticeTick();
}, 20000);

setInterval(() => {
  sendAwayPromptTick();
}, 60000);

setInterval(() => {
  sendWeeklyCameraBriefTick();
}, 20000);

client.on("voiceStateUpdate", (oldState, newState) => {
  const STUDY_VC_CHECK = process.env.STUDY_VC_ID;
  if (STUDY_VC_CHECK && (oldState.channelId === STUDY_VC_CHECK || newState.channelId === STUDY_VC_CHECK)) {
    updateStudyChannelPresence().catch(() => {});
  }

  const userId = newState.id;
  const member = newState.member || oldState.member;
  if (!member) return;
  const guildId = newState.guild?.id || oldState.guild?.id;
  if (!guildId) return;
  const root = normalizeDataRoot(loadData());
  const { data: dataLatest, guild } = withGuildDataById(root, guildId);
  const user = ensureUserExists(guild, member);

  const STUDY_VC_ID = guild.settings.studyVcId || process.env.STUDY_VC_ID;
  const wasInStudy = STUDY_VC_ID ? oldState.channelId === STUDY_VC_ID : !!oldState.channelId;
  const isInStudy = STUDY_VC_ID ? newState.channelId === STUDY_VC_ID : !!newState.channelId;
  const oldVideo = !!oldState.selfVideo || !!oldState.streaming;
  const newVideo = !!newState.selfVideo || !!newState.streaming;
  const now = Date.now();

  const cameraOnAnyVoice = !!newState.channelId && !!newVideo;
  if (user.cameraOn !== cameraOnAnyVoice) {
    user.cameraOn = cameraOnAnyVoice;
    saveData(dataLatest);
  }

  if (AWAY_PROMPT_TARGETS.some((target) => target.userId === userId) && cameraOnAnyVoice && isInStudy) {
    if (user.awayPromptInactiveSince || user.lastAwayPromptAt || user.lastAwayPromptWindowKey) {
      user.awayPromptInactiveSince = null;
      user.lastAwayPromptAt = null;
      user.lastAwayPromptWindowKey = null;
      user.awayPromptSkipPeriodKey = null;
      saveData(dataLatest);
    }
  }

  const usertag = member?.displayName || member?.user?.username || "unknown";
  const logChannelId = guild.settings.logChannelId || process.env.LOG_CHANNEL_ID;
  const logCh = client.channels.cache.get(logChannelId);
  const shouldEmitDiscordLog = !!process.env.FLY_APP_NAME;
  const LOG_COOLDOWN_MS = 3000;
  const logKeyBase = `${guildId}:${userId}`;
  const stateKey = `${logKeyBase}:state`;

  const shouldSendLog = (type) => {
    const key = `${logKeyBase}:${type}`;
    const prev = Number(globalThis.__cameraLogSentAt?.[key] || 0);
    const current = Date.now();
    if (current - prev < LOG_COOLDOWN_MS) return false;
    globalThis.__cameraLogSentAt = globalThis.__cameraLogSentAt || {};
    globalThis.__cameraLogSentAt[key] = current;
    return true;
  };

  const getLastLoggedState = () => {
    return globalThis.__cameraLastLoggedState?.[stateKey] || null;
  };

  const setLastLoggedState = (state) => {
    globalThis.__cameraLastLoggedState = globalThis.__cameraLastLoggedState || {};
    globalThis.__cameraLastLoggedState[stateKey] = state;
  };

  const sendOnLog = () => {
    if (!shouldEmitDiscordLog) return;
    if (getLastLoggedState() === "on") return;
    if (!logCh || !shouldSendLog("on")) return;
      logCh.send(`📷 ${usertag} 캠 ON
🧸스터디 기록은 여기서 볼 수 있어요
https://zzozzozzo.fly.dev/`);
    setLastLoggedState("on");
  };

  const sendOffLog = () => {
    if (getLastLoggedState() === "off") return;
    setLastLoggedState("off");
  };

  const closeCurrentSession = () => {
    if (!user.currentStart && !user.eventStart) return;
    const end = Date.now();
    user.sessions ??= [];

    if (user.currentStart) {
      const tailDuration = Math.floor((end - user.currentStart) / 1000);
      if (tailDuration > 0) {
        user.sessions.unshift({
          start: user.currentStart,
          end,
          seconds: tailDuration,
          source: "auto_split"
        });
      }
    }

    if (user.eventStart) {
      const eventDuration = Math.floor((end - user.eventStart) / 1000);
      if (eventDuration > 0) {
        user.sessions.unshift({
          start: user.eventStart,
          end,
          seconds: eventDuration,
          source: "camera_event"
        });
      }
    }

    user.totalSeconds = aggregateTotalByEventAndManual(user);
    user.currentStart = null;
    user.eventStart = null;
    saveData(dataLatest);
  };

  if (!wasInStudy && isInStudy && newVideo && !user.currentStart) {
    user.currentStart = now;
    if (!user.eventStart) user.eventStart = now;
    saveData(dataLatest);
  }

  if (wasInStudy && !isInStudy) {
    if (oldVideo) sendOffLog();
    closeCurrentSession();
  }

  if (!oldVideo && newVideo && isInStudy) {
    if (!user.currentStart) {
      user.currentStart = now;
      if (!user.eventStart) user.eventStart = now;
      saveData(dataLatest);
    }
    sendOnLog();
  }

  if (oldVideo && !newVideo && isInStudy) {
    closeCurrentSession();
    sendOffLog();
  }






});

client.on("guildMemberAdd", (member) => {
  if (!member || member.user?.bot) return;
  const guildId = member.guild?.id;
  if (!guildId) return;

  const root = normalizeDataRoot(loadData());
  const { data: latestData, guild } = withGuildDataById(root, guildId);
  const user = ensureUserExists(guild, member);
  user.avatar = member.user.displayAvatarURL?.() || null;
  user.nickname = member.displayName || member.user.username;
  user.username = member.user.username;
  saveData(latestData);
});


client.on("interactionCreate", async (interaction) => {


  try {
    const { MessageFlags } = require("discord.js");

    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "away" && interaction.commandName !== "back") return;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "Discord 관리자만 사용할 수 있는 명령입니다.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: "서버 안에서만 사용할 수 있는 명령입니다.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (interaction.commandName === "back") {
      const root = normalizeDataRoot(loadData());
      const previous = clearAwayReservation(root, guildId);
      const channel = await resolveStudyVoiceChannel(guildId, previous?.channelId);
      await setVoiceChannelStatus(client.rest, channel.id, null);
      clearAwayTimer(guildId);
      saveData(root);
      await interaction.editReply("STUDY 음성채널의 자리 비움 상태를 삭제했습니다.");
      return;
    }

    const time = interaction.options.getString("시간", true).trim();
    const message = interaction.options.getString("메시지") || "";
    const endAt = parseKstAwayEndAt(time);
    const status = buildAwayStatus(time, message);
    const channel = await resolveStudyVoiceChannel(guildId);
    await setVoiceChannelStatus(client.rest, channel.id, status);

    const root = normalizeDataRoot(loadData());
    const reservation = { channelId: channel.id, endAt, status };
    saveAwayReservation(root, guildId, reservation);
    saveData(root);
    scheduleAwayExpiration(guildId, reservation);

    await interaction.editReply(`상태를 설정했습니다: ${status}`);
  } catch (err) {
    console.error("❌ interactionCreate error:", err);
    const { MessageFlags } = require("discord.js")
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "처리 중 오류가 발생했어", flags: MessageFlags.Ephemeral });
      } else {
        await interaction.editReply("처리 중 오류가 발생했어");
      }
    } catch (_) {}
  }
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;

  const content = msg.content.trim();
  const userId = msg.author.id;

  const guildId = msg.guildId || process.env.DEFAULT_GUILD_ID || process.env.GUILD_ID || "default";
  const handledAwayShortcut = await executeAwayShortcut({
    content,
    isAdmin: Boolean(
      msg.guildId && msg.member?.permissions?.has(PermissionFlagsBits.Administrator)
    ),
    deleteTrigger: () => msg.delete(),
    onDeleteError: (err) => {
      console.error("away shortcut message delete failed:", err?.message || err);
    },
    activate: async (reservationInput) => {
      const channel = await resolveStudyVoiceChannel(guildId);
      const reservation = { ...reservationInput, channelId: channel.id };

      if (Number.isFinite(Number(reservation.startAt)) && reservation.startAt > Date.now()) {
        await setVoiceChannelStatus(client.rest, channel.id, null);
      } else {
        await setVoiceChannelStatus(client.rest, channel.id, reservation.status);
      }

      const latestRoot = normalizeDataRoot(loadData());
      saveAwayReservation(latestRoot, guildId, reservation);
      saveData(latestRoot);

      if (Number.isFinite(Number(reservation.startAt)) && reservation.startAt > Date.now()) {
        scheduleAwayActivation(guildId, reservation);
      } else {
        scheduleAwayExpiration(guildId, reservation);
      }
    }
  }).catch((err) => {
    console.error("away shortcut failed:", err?.message || err);
    return true;
  });
  if (handledAwayShortcut) return;

  const root = normalizeDataRoot(loadData());
  const { data: latestData, guild } = withGuildDataById(root, guildId);

  const user = guild.users[userId];
  if (!user) return;

  if (content === '!help') {
    await msg.reply(
  '📘 **스터디 봇 사용법**\n\n' +
      '⏰ `!time`\n' +
      '📅 `!today`\n' +
      '📆 `!week`\n' +
      '🎯 `!goal 3h`\n' +
      '📝 `!memo 메모내용` / `!memo` / `!memo clear`\n'

    );
    return;
  }

  if (content === '!time') {
    const { todaysec, weekSec } = computeTodayWeekAll(user);

    await msg.reply(
     `🕒 ${user.nickname || msg.author.username}\n` +
      `- 오늘: ${formatSeconds(todaysec)}\n` +
      `- 이번주: ${formatSeconds(weekSec)}`
    );
    return;
  }

  if (content === '!today') {
    const { todaysec } = computeTodayWeekAll(user);
    await msg.reply(`📅 오늘 공부: ${formatSeconds(todaysec)}`);
    return;
  }

  if (content === '!week') {
    const { weekSec } = computeTodayWeekAll(user);
    await msg.reply(`📆 이번 주: ${formatSeconds(weekSec)}`);
    return;
  }

  if (content === '!memo' || content.startsWith('!memo ')) {
    const todayKey = getKstDateParts(Date.now()).dateKey;
    const rawMemo = content.slice('!memo'.length).trim();
    const savedMemo = user.commandMemo && typeof user.commandMemo === "object"
      ? user.commandMemo
      : null;

    if (savedMemo && savedMemo.dateKey !== todayKey) {
      user.commandMemo = null;
      saveData(latestData);
    }

    if (!rawMemo) {
      const currentMemo = user.commandMemo?.dateKey === todayKey
        ? String(user.commandMemo?.text || "").trim()
        : "";
      await msg.reply(currentMemo ? `📝 오늘 메모\n${currentMemo}` : "📝 오늘 저장된 메모가 없습니다.");
      return;
    }

    if (rawMemo.toLowerCase() === "clear") {
      user.commandMemo = null;
      saveData(latestData);
      await msg.reply("📝 오늘 메모를 지웠습니다.");
      return;
    }

    user.commandMemo = {
      dateKey: todayKey,
      text: rawMemo,
      updatedAt: Date.now()
    };
    addCommandMemoRecord(user, rawMemo, user.commandMemo.updatedAt);
    saveData(latestData);
    await msg.reply("📝 메모를 저장했습니다.");
    return;
  }

  if (content.startsWith('!goal')) {
    const value = content.split(/\s+/).slice(1).join(' ');
    const sec = parseGoalToSeconds(value);

    if (sec === null) {
      await msg.reply('형식: !goal 3h / !goal 150m / !goal off');
      return;
    }

    user.goalSec = sec;
    if (sec > 0) {
      user.monthGoalHours = Math.max(1, Math.round(sec / 3600));
    }
    saveData(latestData);

   await msg.reply('✅ 목표 설정 완료');
    return;
  }

});

const discordLoginPolicy = shouldLoginDiscordClient(process.env);
if (!discordLoginPolicy.ok && discordLoginPolicy.reason === "missing-token") {
  console.error("Bot login skipped: missing DISCORD_TOKEN/BOT_TOKEN (.env not loaded)");
} else if (!discordLoginPolicy.ok) {
  console.warn(
    "Discord bot login skipped for local run. " +
    "Set ENABLE_LOCAL_DISCORD_LOGIN=true only when Fly/production is not running."
  );
} else {
  void loginDiscordClient("startup");
}
