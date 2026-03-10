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
  console.log(`Web server running on port ${PORT}`);
  console.log("BOT STARTED");
});




const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent

  ],
  partials: [Partials.GuildMember]
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
      studyRecords: [],
      freeGoals: [],
      monthGoalHours: 40,
      currentStart: null,
      eventStart: null
    };

    console.log("[NEW USER] created:", userId);
  }

  if (guildData.users[userId].eventStart === undefined) {
    guildData.users[userId].eventStart = null;
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

client.on("error", err => {
  console.error("Discord Client Error:", err);
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
        if (member.voice.selfVideo) {
          user.currentStart = now;
          user.eventStart = now;
          console.log("?ъ떆???숆린?????⑤씪??", member.user.username);
        }
      });
    }
  } catch (err) {
    console.error("clientReady study channel sync failed:", err?.message || err);
  }
}

   console.log("[READY] bot login complete");
  for (const guild of client.guilds.cache.values()) {
    await guild.members.fetch();
    const { guild: guildData } = withGuildDataById(data, guild.id);
    guild.members.cache.forEach((member) => {
      const user = ensureUserExists(guildData, member);
      user.avatar = member.user.displayAvatarURL?.() || null;
      user.nickname = member.displayName;
      user.username = member.user.username;
    });
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

function computeTodayWeekAll(user) {

  const now = Date.now();
  const todayStart = kstStartOfTodayMs(now);

  const day = new Date(now).getDay(); // 0=Sunday
  const diff = day === 0 ? 6 : day - 1;
  const weekStart = todayStart - diff * DAY_MS;

  let todaysec = 0;
  let weekSec = 0;


for (const s of user.sessions || []) {
  const start = typeof s.start === "number" ? s.start : Date.parse(s.start);
  const end = typeof s.end === "number" ? s.end : Date.parse(s.end);
  const overlap = overlapSeconds(start, end, todayStart, todayStart + DAY_MS);

}

  return {
    todaysec: Math.floor(todaysec),
    weekSec: Math.floor(weekSec),
    allSec: user.totalSeconds || 0

  };

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
        saveData(data);
        console.log("? ?먮룞 遺꾪븷 ????꾨즺!", guildId, userId, duration);
      }
    }
  }

}, 30000);

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
  const wasInStudy = !!STUDY_VC_ID && oldState.channelId === STUDY_VC_ID;
  const isInStudy = !!STUDY_VC_ID && newState.channelId === STUDY_VC_ID;
  const oldVideo = !!oldState.selfVideo;
  const newVideo = !!newState.selfVideo;
  const now = Date.now();

  const usertag = member?.displayName || member?.user?.username || "unknown";
  const logChannelId = guild.settings.logChannelId || process.env.LOG_CHANNEL_ID;
  const logCh = client.channels.cache.get(logChannelId);

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
    closeCurrentSession();
  }

  if (!oldVideo && newVideo && isInStudy) {
    if (!user.currentStart) {
      user.currentStart = now;
      if (!user.eventStart) user.eventStart = now;
      saveData(dataLatest);
    }
     logCh?.send(`[CAM ON] ${usertag}` + "\n" +
"Study log: https://zzozzozzo.fly.dev/");
  }

  if (oldVideo && !newVideo && isInStudy) {
    closeCurrentSession();
   logCh?.send(`[CAM OFF] ${usertag}`);
  }






});

client.on('messageCreate', async (msg) => {

  if (msg.author.bot) return;

  const content = msg.content.trim();
  const userId = msg.author.id;
  const guildId = msg.guildId || process.env.DEFAULT_GUILD_ID || process.env.GUILD_ID || "default";
  const root = normalizeDataRoot(loadData());
  const { data: latestData, guild } = withGuildDataById(root, guildId);
  const user = guild.users[userId];
  if (!user) return;

  if (content === '!help') {
    await msg.reply(
  "**Study Bot Commands**\n\n" +
      "- `!time`\n" +
      "- `!today`\n" +
      "- `!week`\n" +
      "- `!goal 3h`\n"
    );
    return;
  }

  if (content === '!time') {
    const { todaysec, weekSec, allSec } = computeTodayWeekAll(user);

    await msg.reply(
      `User: ${user.nickname || msg.author.username}\n` +
      `- Today: ${formatSeconds(todaysec)}\n` +
      `- This week: ${formatSeconds(weekSec)}\n` +
      `- Total: ${formatSeconds(allSec)}`
    );
    return;
  }

  if (content === '!today') {
    const { todaysec } = computeTodayWeekAll(user);
    await msg.reply(`Today: ${formatSeconds(todaysec)}`);
    return;
  }

  if (content === '!week') {
    const { weekSec } = computeTodayWeekAll(user);
    await msg.reply(`This week: ${formatSeconds(weekSec)}`);
    return;
  }

  if (content.startsWith('!goal')) {
    const value = content.split(/\s+/).slice(1).join(' ');
    const sec = parseGoalToSeconds(value);

    if (sec === null) {
      await msg.reply('?뺤떇: !goal 3h / !goal 150m / !goal off');
      return;
    }

    user.goaltodaysec = sec;
    saveData(latestData);

   await msg.reply('? 紐⑺몴 ?ㅼ젙 ?꾨즺');
    return;
  }

});

client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log("Discord bot logged in"))
  .catch((err) => console.error("Bot login failed:", err));


