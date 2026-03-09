require("dotenv").config();

const express = require("express");
const app = express();
const PORT = process.env.PORT || 8080;

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





const { Client, GatewayIntentBits, Partials } = require('discord.js');
const createAdminRouter = require('./routes/admin');
const { loadData, saveData } = require('./data/store');
let data = loadData();

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
  console.log("BOT STARTED");
});




app.use(express.json());

app.get("/save-memo", (req, res) => {
  const { memo } = req.query;

feed.push({
  type: "memo",
  text: memo,
  createdAt: Date.now()
});

  res.json({ ok: true });
});
app.get('/favicon.ico', (req, res) => res.status(204));



app.post("/manual", (req, res) => {
  const { userId, minutes } = req.body;

  const latest = loadData();
  const user = latest.users[userId];

  if (!user) return res.json({ ok: false });

  user.sessions ??= [];

  const now = Date.now();
  const seconds = Math.floor(Number(minutes) * 60);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return res.status(400).json({ ok: false, error: "invalid minutes" });
  }

  const manualSessions = user.sessions.filter((s) => s && (s.manual === true || s.source === "manual"));
  const duplicated = manualSessions.some((s) => {
    const sec = Number(s?.seconds || 0);
    const st = typeof s?.start === "number" ? s.start : Date.parse(s?.start);
    if (!Number.isFinite(st)) return false;
    return sec === seconds && Math.abs(st - now) <= 10000;
  });
  if (duplicated) {
    return res.json({ ok: true, deduped: true });
  }

  user.sessions.push({
    start: now - seconds * 1000,
    end: now,
    seconds,
    manual: true,
    source: "manual"
  });

  user.totalSeconds = aggregateTotalByEventAndManual(user);

  saveData(latest);

  res.json({ ok: true });
});

app.post("/edit-session", (req, res) => {
  const { userId, index, newSeconds } = req.body;

  const latest = loadData();
  const user = latest.users[userId]; // target user

  if (!user) {
    return res.status(404).json({ ok: false });
  }

  if (!user.sessions || !user.sessions[index]) {
    return res.status(400).json({ ok: false });
  }

  user.sessions[index].seconds = Number(newSeconds);
  user.sessions[index].editTime = Date.now();
  user.totalSeconds = aggregateTotalByEventAndManual(user);

  saveData(latest);

  res.json({ ok: true });
});

app.post("/delete-session", (req, res) => {
  const { userId, index } = req.body;

  const latest = loadData();
  const user = latest.users[userId];

  if (!user) return res.status(404).json({ ok: false });

  if (!user.sessions || !user.sessions[index]) {
    return res.status(400).json({ ok: false });
  }

  user.sessions.splice(index, 1);
  user.totalSeconds = aggregateTotalByEventAndManual(user);
  saveData(latest);

  res.json({ ok: true });
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


(async () => {
  try {
    await client.login(process.env.DISCORD_TOKEN)
    console.log("Discord bot logged in")
  } catch (err) {
    console.error("Bot login failed:", err)
  }
})();


// Register admin routes after client is created
app.use('/', createAdminRouter(client));


function ensureUserExists(data, member) {
  if (!data.users) data.users = {};

  const userId = member.id;

  if (!data.users[userId]) {
    data.users[userId] = {
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

    console.log("🆕 신규 유저 생성:", userId);
  }

  if (data.users[userId].eventStart === undefined) {
    data.users[userId].eventStart = null;
  }

  return data.users[userId];
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

if (!STUDY_VC_ID) {
  console.log("STUDY_VC_ID not set, skipping channel fetch");
  return;
}

const channel = await client.channels.fetch(STUDY_VC_ID);

const now = Date.now();
  if (!channel) return;
 
  Object.values(data.users).forEach((u) => {
    if (!u) return;
    u.currentStart = null;
    u.eventStart = null;
  });

client.on("error", err => {
  console.error("Discord Client Error:", err);
});


channel.members.forEach(member => {
  if (!member.user.bot && member.voice.selfVideo) {
    if (data.users[member.id]) {
      data.users[member.id].currentStart = now;
      data.users[member.id].eventStart = now;
      console.log("재시작 동기화 → 온라인:", member.user.username);
    }
  }
});



   console.log('👾봇 로그인 완료!');

  const guild = client.guilds.cache.first();
  if (!guild) return;

  await guild.members.fetch();

  guild.members.cache.forEach(member => {
    const userId = member.id;

   

const user = ensureUserExists(data, member);
user.avatar = member.user.displayAvatarURL?.() || null;
    data.users[userId].nickname = member.displayName;
  });


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

  const day = new Date(now).getDay(); // 0=??
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

  const data = loadData();

  const user = ensureUserExists(data, member);

  // Keep latest profile fields in sync
  user.nickname = member.displayName || member.user.username;
  user.username = member.user.username;
  user.avatar = member.user.displayAvatarURL?.() || null;

markDirty();
});



setInterval(() => {

  const data = loadData(); // reload latest data every tick
  const now = Date.now();

  for (const userId in data.users) {

    const user = data.users[userId];
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

      console.log("✅ 자동 분할 저장 완료!", userId, duration);
    }
  }

}, 30000);

client.on("voiceStateUpdate", (oldState, newState) => {
  const userId = newState.id;
  const member = newState.member || oldState.member;
  if (!member) return;
  const dataLatest = loadData();
  const user = ensureUserExists(dataLatest, member);

  const STUDY_VC_ID = process.env.STUDY_VC_ID;
  const wasInStudy = oldState.channelId === STUDY_VC_ID;
  const isInStudy = newState.channelId === STUDY_VC_ID;
  const oldVideo = !!oldState.selfVideo;
  const newVideo = !!newState.selfVideo;
  const now = Date.now();

  const usertag = member?.displayName || member?.user?.username || "unknown";
  const logCh = client.channels.cache.get(process.env.LOG_CHANNEL_ID);

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
     logCh?.send(`📷 ${usertag} 캠 ON
스터디 기록은 여기서 볼 수 있어요
https://zzozzozzo.fly.dev/`);
  }

  if (oldVideo && !newVideo && isInStudy) {
    closeCurrentSession();
   logCh?.send(`📷 ${usertag} 캠 OFF`);
  }






});

client.on('messageCreate', async (msg) => {

  if (msg.author.bot) return;

  const content = msg.content.trim();
  const userId = msg.author.id;

  const user = data.users[userId];
  if (!user) return;

  if (content === '!help') {
    await msg.reply(
  '📘 **스터디 봇 사용법**\n\n' +
      '⏰ `!time`\n' +
      '📅 `!today`\n' +
      '📆 `!week`\n' +
      '🎯 `!goal 3h`\n'
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

    user.goaltodaysec = sec;
    saveData(data);

   await msg.reply('✅ 목표 설정 완료');
    return;
  }

});

client.login(process.env.DISCORD_TOKEN);


