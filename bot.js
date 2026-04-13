require("dotenv").config({ override: true });
const express = require("express");
const app = express();
const PORT = process.env.PORT || 8080;
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const createAdminRouter = require('./routes/admin');
const { loadData, saveData } = require('./data/store');
const { ensureGuild, normalizeDataRoot } = require('./data/guild-data');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
let data = loadData();
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

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
    // ⚠️ [FIX] DirectMessages intent 추가 — DM messageCreate/interaction 수신에 필요
    // (버튼 interaction은 intent 없이도 작동하지만, DM messageCreate에는 필요)
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.GuildMember,
    // ⚠️ [FIX] DM 채널 파셜 추가 — DM 상호작용을 안정적으로 수신하기 위해 필요
    Partials.Channel
  ]
});

// ⚠️ [FIX] error 핸들러는 ready 안이 아니라 최상위에 등록해야 함.
// ready 안에 있으면 ready 이벤트 전에 발생하는 에러를 잡지 못함.
client.on("error", err => {
  console.error("Discord Client Error:", err);
});

// Register admin routes after client is created
app.use('/', createAdminRouter(client));




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
    await ensureCheerSlashCommand(guild);
  }

  saveData(data);


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

function computeTodayWeekAll(user) {

  const now = Date.now();
  const todayStart = kstStartOfTodayMs(now);

  const day = new Date(now).getDay(); // 0=Sunday
  const diff = day === 0 ? 6 : day - 1;
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

const QUIET_CHEER_PIN_TEXT = "오늘도 각자 자리에서 열심히 하는 중 🔥 조용히 응원을 보내고 싶다면 버튼을 눌러주세요!";
const QUIET_CHEER_BUTTON_ID = "quiet_cheer_send";
const CAM_REVIEW_BUTTON_PREFIX = "cam_review";
const ENABLE_DM_REVIEW_BUTTON = true;
const ENABLE_NIGHTLY_REVIEW_DM = true;
// customId format:
// quiet cheer: "quiet_cheer_send"
// cam review:  "cam_review:<guildId>:<userId>:<moodKey>"
const CAM_REVIEW_OPTIONS = [
  { key: "great", label: "오늘 만족" },
  { key: "okay", label: "그럭저럭" },
  { key: "broken", label: "흐름 끊김" },
  { key: "sat", label: "그래도 앉음" }
];
const RANDOM_CHEER_TEXTS = [
  "오늘도 묵묵히 쌓는 중 🌿",
  "지금처럼만 가도 충분히 잘하고 있어요",
  "집중의 흐름 이어가보자구요🔥",
  "한 칸씩 전진하는 중, 아주 좋아요",
  "조용히 응원 두고 갈게요 🙌"
];

function pickRandom(list = []) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function buildQuietCheerPayload(count) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(QUIET_CHEER_BUTTON_ID)
      .setLabel("🌿 조용한 응원 보내기")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    content:
      "오늘도 각자 자리에서 열심히 하는 중🔥\n" +
      "조용히 응원을 보내고 싶다면 버튼을 눌러주세요\n\n" +
      `🌿조용한 응원 ${count}회`,
    components: [row]
  };
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

async function ensureQuietCheerPinnedMessage(discordGuild, guildData) {
  try {
    if (!process.env.FLY_APP_NAME) return; // 로컬 실행 중 중복 생성 방지
    const textChannel = await resolveStudyTextChannel(discordGuild, guildData);
    if (!textChannel) return;

    const { dateKey } = getKstDateParts(Date.now());
    const count = Number(guildData.settings.quietCheerCount || 0);
    const payload = buildQuietCheerPayload(count);

    guildData.settings ??= {};
    const savedDateKey = String(guildData.settings.quietCheerDateKey || "");
    const savedId = String(guildData.settings.quietCheerMessageId || "");
    let msg = null;
    let matchedMessages = [];
    if (savedId && savedDateKey === dateKey) {
      try {
        msg = await textChannel.messages.fetch(savedId);
      } catch (_) {
        msg = null;
      }
    }

    if (!msg) {
      try {
        const recent = await textChannel.messages.fetch({ limit: 30 });
        matchedMessages = recent.filter((m) => {
          if (!m || m.author?.id !== client.user?.id) return false;
          const hasQuietBtn = (m.components || []).some((row) =>
            (row.components || []).some((c) => c.customId === QUIET_CHEER_BUTTON_ID)
          );
          return hasQuietBtn || String(m.content || "").includes("조용히 응원을 보내고 싶다면");
        });
        matchedMessages.sort((a, b) => Number(b.createdTimestamp || 0) - Number(a.createdTimestamp || 0));
        msg = matchedMessages[0] || null;
      } catch (_) {
        msg = null;
        matchedMessages = [];
      }
    }

    if (msg && msg.author?.id === client.user?.id) {
      await msg.edit(payload);
      guildData.settings.quietCheerMessageId = msg.id;
      guildData.settings.quietCheerDateKey = dateKey;
      for (const oldMsg of matchedMessages) {
        if (!oldMsg || oldMsg.id === msg.id) continue;
        try { await oldMsg.delete(); } catch (_) {}
      }
      return;
    }

    const sent = await textChannel.send(payload);
    guildData.settings.quietCheerMessageId = sent.id;
    guildData.settings.quietCheerDateKey = dateKey;
  } catch (err) {
    console.error("ensure quiet cheer message failed:", err?.message || err);
  }
}

let __quietCheerTickBusy = false;
const __quietCheerSent = new Set();
async function sendDailyQuietCheerTick() {
  if (__quietCheerTickBusy) return;
  __quietCheerTickBusy = true;
  try {
    if (!client.isReady()) return;
    if (!process.env.FLY_APP_NAME) return;

    const { dateKey, hhmm } = getKstDateParts(Date.now());
    if (hhmm !== "12:00") return;

    const root = normalizeDataRoot(loadData());
    root.meta ??= {};
    root.meta.quietCheerSentByGuild ??= {};
    let changed = false;

    for (const discordGuild of client.guilds.cache.values()) {
      const guildId = discordGuild.id;
      const onceKey = `${guildId}:${dateKey}`;
      if (__quietCheerSent.has(onceKey)) continue;
      if (root.meta.quietCheerSentByGuild[guildId] === dateKey) continue;

      const { guild } = withGuildDataById(root, guildId);
      guild.settings ??= {};
      guild.settings.quietCheerCount = 0;
      await ensureQuietCheerPinnedMessage(discordGuild, guild);
      root.meta.quietCheerSentByGuild[guildId] = dateKey;
      __quietCheerSent.add(onceKey);
      changed = true;
    }

    if (changed) saveData(root);
  } catch (err) {
    console.error("daily quiet cheer tick failed:", err?.message || err);
  } finally {
    __quietCheerTickBusy = false;
  }
}

async function ensureCheerSlashCommand(discordGuild) {
  try {
    const desired = {
      name: "응원",
      description: "캠 활성화 중인 사람에게 랜덤 응원을 보냅니다."
    };

    const commands = await discordGuild.commands.fetch();
    const existing = commands.find((c) => c.name === desired.name);
    if (!existing) {
      await discordGuild.commands.create(desired);
      return;
    }
    if (existing.description !== desired.description) {
      await existing.edit(desired);
    }
  } catch (err) {
    console.error("ensure /응원 failed:", err?.message || err);
  }
}

// ──────────────────────────────────────────────
// customId 설계 (봇 재시작 후에도 작동하는 영구적 라우팅)
// ──────────────────────────────────────────────
// ● 조용한 응원 버튼:  "quiet_cheer_send"
//   → 고정, 단일 ID. guildId는 interaction.guildId에서 가져옴.
//
// ● 캠 회고 버튼:  "cam_review:<guildId>:<userId>:<moodKey>"
//   예) "cam_review:123456789:987654321:great"
//   → guildId: 어느 서버 데이터에 저장할지
//   → userId:  본인 확인용 (interaction.user.id와 비교)
//   → moodKey: "great" | "okay" | "broken" | "sat"
//
// ※ collector 방식이 실패하는 이유:
//   - createMessageComponentCollector는 메시지 객체에 바인딩됨
//   - 봇이 재시작되면 메모리의 collector가 사라져서
//     이미 보낸 DM의 버튼을 눌러도 아무 핸들러가 없어 "상호작용 실패" 발생
//   - 전역 interactionCreate + customId 파싱 방식은
//     봇이 재시작되어도 customId만 파싱하면 되므로 영구 작동
// ──────────────────────────────────────────────

async function sendReviewPromptDm(
  member,
  guildId,
  promptText = "오늘 참여한 기록이 있어 🙌 짧게 회고 남겨줘"
) {
  try {
    if (!ENABLE_DM_REVIEW_BUTTON) {
      console.log("⚠️ sendReviewPromptDm: ENABLE_DM_REVIEW_BUTTON is false, skipping");
      return false;
    }

    // member가 User 객체일 수도 있고 GuildMember일 수도 있음 — 둘 다 createDM() 지원
    const userId = member.id || member.user?.id;
    if (!userId) {
      console.error("⚠️ sendReviewPromptDm: member.id가 없음");
      return false;
    }

    const dm = await member.createDM();
    const row = new ActionRowBuilder().addComponents(
  CAM_REVIEW_OPTIONS.map((opt) =>
    new ButtonBuilder()
      .setCustomId(`${CAM_REVIEW_BUTTON_PREFIX}:${guildId}:${userId}:${opt.key}`)
      .setLabel(opt.label)
      .setStyle(ButtonStyle.Secondary)
  )
);

await dm.send({
  content: promptText,
  components: [row]
});
    console.log(`✅ 회고 DM 전송 완료 → userId=${userId}, guildId=${guildId}`);
    return true;
  } catch (err) {
    // ⚠️ [FIX] 에러를 무시하지 않고 로그 출력 — 디버깅에 필수
    console.error("❌ sendReviewPromptDm 실패:", err?.message || err);
    return false;
  }
}

let __nightlyReviewTickBusy = false;
const __nightlyReviewSent = new Set();
async function sendNightlyReviewPromptTick() {
  if (__nightlyReviewTickBusy) return;
  __nightlyReviewTickBusy = true;
  try {
    if (!ENABLE_NIGHTLY_REVIEW_DM) return;
    if (!client.isReady()) return;
    if (!process.env.FLY_APP_NAME) return; // 운영에서만 전송

    const now = Date.now();
    const { dateKey, hhmm } = getKstDateParts(now);
    if (hhmm !== "21:00") return;

    const root = normalizeDataRoot(loadData());
    root.meta ??= {};
    root.meta.nightlyReviewSentByGuild ??= {};
    let changed = false;

    for (const discordGuild of client.guilds.cache.values()) {
      const guildId = discordGuild.id;
      const onceKey = `${guildId}:${dateKey}`;
      if (__nightlyReviewSent.has(onceKey)) continue;
      if (root.meta.nightlyReviewSentByGuild[guildId] === dateKey) continue;

      const { guild } = withGuildDataById(root, guildId);
      const targets = Object.entries(guild.users || {})
        .filter(([_, user]) => {
          if (!user || typeof user !== "object") return false;
          const todaysec = Number(computeTodayWeekAll(user)?.todaysec || 0);
          return todaysec > 0 || Number(user.currentStart || 0) > 0;
        })
        .map(([userId]) => userId);

      if (targets.length > 0) {
        try {
          await discordGuild.members.fetch();
        } catch (_) {}
      }

      for (const userId of targets) {
        const member = discordGuild.members.cache.get(userId);
        if (!member || member.user?.bot) continue;

        const user = ensureUserExists(guild, member);
        if (String(user.lastReviewPromptDate || "") === dateKey) continue;

        await sendReviewPromptDm(
          member,
          guildId,
          "오늘 참여한 기록이 있어요 🙌 짧게 회고 남겨주세요"
        );

        user.lastReviewPromptAt = now;
        user.lastReviewPromptDate = dateKey;
        changed = true;
      }

      root.meta.nightlyReviewSentByGuild[guildId] = dateKey;
      __nightlyReviewSent.add(onceKey);
      changed = true;
    }

    if (changed) {
      saveData(root);
    }
  } catch (err) {
    console.error("nightly review tick failed:", err?.message || err);
  } finally {
    __nightlyReviewTickBusy = false;
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

let __periodNoticeTickBusy = false;
const __periodNoticeSent = new Set();

async function sendPeriodEndNoticeTick() {
  if (__periodNoticeTickBusy) return;
  __periodNoticeTickBusy = true;

  try {
    if (!client.isReady()) return;
    if (!process.env.FLY_APP_NAME) return; // 로컬 중복 전송 방지

    const { dateKey, hhmm } = getKstDateParts(Date.now());
    const hit = PERIOD_END_SCHEDULE.find((x) => x.end === hhmm);
    if (!hit) return;

    const root = normalizeDataRoot(loadData());
    root.meta ??= {};
    root.meta.periodNoticeSentByChannel ??= {};
    const guildIds = Object.keys(root?.guilds || {});
    let changed = false;

    for (const guildId of guildIds) {
      const { guild } = withGuildDataById(root, guildId);
      const camChannelId = guild?.settings?.studyVcId || process.env.STUDY_VC_ID;
      if (!camChannelId) continue;

      // 같은 채널을 여러 guild 키(default/실제 guild)에서 참조해도 1번만 전송
      const onceKey = `${camChannelId}:${dateKey}:${hit.key}`;
      if (__periodNoticeSent.has(onceKey)) continue;
      const persistedKey = `${camChannelId}:${hit.key}`;
      if (root.meta.periodNoticeSentByChannel[persistedKey] === dateKey) continue;

      let ch = client.channels.cache.get(camChannelId);
      if (!ch) {
        try {
          ch = await client.channels.fetch(camChannelId);
        } catch (_) {
          ch = null;
        }
      }
      if (!ch || typeof ch.send !== "function") continue;

      await ch.send(hit.message);
      __periodNoticeSent.add(onceKey);
      root.meta.periodNoticeSentByChannel[persistedKey] = dateKey;
      changed = true;
    }

    // 메모리 누적 방지 (오늘 날짜 키만 유지)
    const keepPrefix = `:${dateKey}:`;
    for (const key of Array.from(__periodNoticeSent)) {
      if (!key.includes(keepPrefix)) __periodNoticeSent.delete(key);
    }
    if (changed) {
      saveData(root);
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

}, 30000);

setInterval(() => {
  reconcileLiveStates();
}, 60000);

setInterval(() => {
  sendPeriodEndNoticeTick();
}, 20000);

setInterval(() => {
  sendDailyQuietCheerTick();
}, 20000);

setInterval(() => {
  sendNightlyReviewPromptTick();
}, 20000);

client.on("voiceStateUpdate", (oldState, newState) => {
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
    if (!shouldEmitDiscordLog) return;
    if (getLastLoggedState() === "off") return;
    if (!logCh || !shouldSendLog("off")) return;
    logCh.send(`📷 ${usertag} 캠 OFF`);
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

  const logChannelId = guild.settings.logChannelId || process.env.LOG_CHANNEL_ID;
  const logCh = client.channels.cache.get(logChannelId);
  const shouldEmitDiscordLog = !!process.env.FLY_APP_NAME;
  if (shouldEmitDiscordLog) {
    logCh?.send(`👋 ${user.nickname} 님이 새로 등록되었습니다`);
  }
});


client.on("interactionCreate", async (interaction) => {


  try {
    if (!interaction.isButton()) return;


    await interaction.deferReply({ ephemeral: true });

    if (interaction.customId.startsWith("cam_review:")) {
      const [_, guildId, userId, moodKey] = interaction.customId.split(":");

      if (interaction.user.id !== userId) {
        await interaction.editReply("이 버튼은 본인만 눌러야 해");
        return;
      }

      const root = normalizeDataRoot(loadData());
      const { data, guild } = withGuildDataById(root, guildId);

      guild.users ??= {};
      guild.users[userId] ??= {
        id: userId,
        sessions: [],
        totalSeconds: 0
      };

      const user = guild.users[userId];
      const labelMap = {
        great: "오늘 만족",
        okay: "그럭저럭",
        broken: "흐름 끊김",
        sat: "그래도 앉음"
      }
      user.reviews ??= [];
      user.reviews.unshift({
        at: Date.now(),
        dateKey: getKstDateParts(Date.now()).dateKey,
        mood: moodKey,
        label: labelMap[moodKey] || moodKey,
        source: "cam_off_prompt",
        guildId
      });

      saveData(data);

      const latest = user.reviews?.[0];
      if (
        latest &&
        latest.source === "cam_off_prompt" &&
        latest.dateKey === getKstDateParts(Date.now()).dateKey
      )
      await interaction.editReply("회고 저장 완료 👍");
      return;
    }

    if (interaction.customId === QUIET_CHEER_BUTTON_ID) {
      if (!interaction.guildId) {
        await interaction.editReply("서버에서만 사용할 수 있어");
        return;
      }

      const root = normalizeDataRoot(loadData());
      const { data, guild } = withGuildDataById(root, interaction.guildId);
      guild.settings ??= {};
      guild.settings.quietCheerCount = Number(guild.settings.quietCheerCount || 0) + 1;
      guild.settings.quietCheerDateKey = getKstDateParts(Date.now()).dateKey;

      const nextPayload = buildQuietCheerPayload(guild.settings.quietCheerCount);
      try {
        if (interaction.message && typeof interaction.message.edit === "function") {
          await interaction.message.edit(nextPayload);
          guild.settings.quietCheerMessageId = interaction.message.id;
        }
      } catch (err) {
        console.error("❌ quiet cheer update failed:", err?.message || err);
      }

      saveData(data);
      await interaction.editReply("조용한 응원을 남겼어 🌿");
      return;
    }



  } catch (err) {
    console.error("❌ interactionCreate error:", err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "처리 중 오류가 발생했어", ephemeral: true });
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
  const root = normalizeDataRoot(loadData());
  const { data: latestData, guild } = withGuildDataById(root, guildId);

  if (content === '!응원고정') {
    guild.settings ??= {};
    guild.settings.quietCheerMessageId = null;
    await ensureQuietCheerPinnedMessage(msg.guild, guild);
    saveData(latestData);
    await msg.reply('응원 고정메시지 갱신 완료');
    return;
  }



  const user = guild.users[userId];
  if (!user) return;

  if (content === '!help') {
    await msg.reply(
  '📘 **스터디 봇 사용법**\n\n' +
      '⏰ `!time`\n' +
      '📅 `!today`\n' +
      '📆 `!week`\n' +
      '🎯 `!goal 3h`\n' +
      '🌿 `!응원고정`\n'

    );
    return;
  }

  if (content === '!time') {
    const { todaysec, weekSec, allSec } = computeTodayWeekAll(user);

    await msg.reply(
     `🕒 ${user.nickname || msg.author.username}\n` +
      `- 오늘: ${formatSeconds(todaysec)}\n` +
      `- 이번주: ${formatSeconds(weekSec)}\n` +
      `- 누적: ${formatSeconds(allSec)}`
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

const DISCORD_LOGIN_TOKEN = String(
  process.env.DISCORD_TOKEN ||
  process.env.BOT_TOKEN ||
  ""
).trim();

if (!DISCORD_LOGIN_TOKEN) {
  console.error("Bot login skipped: missing DISCORD_TOKEN/BOT_TOKEN (.env not loaded)");
} else {
  client.login(DISCORD_LOGIN_TOKEN)
    .then(() => console.log("Discord bot logged in"))
    .catch((err) => console.error("Bot login failed:", err));
}


