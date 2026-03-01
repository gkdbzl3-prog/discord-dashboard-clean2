require('dotenv').config();
console.log("BOT STARTED");
const express = require('express');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const createAdminRouter = require('./routes/admin');
const { loadData, saveData } = require('./data/store');

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.get("/save-memo", (req, res) => {
  const { memo } = req.query;

 feed.push({
  type: "memo",
  userId: window.currentUserId,   // 🔥 추가
  text: memoText,
  createdAt: Date.now()
});

  res.json({ ok: true });
});
app.get('/favicon.ico', (req, res) => res.status(204));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.GuildMember]
});

// 👇 client 만든 다음 라우터 등록
app.use('/', createAdminRouter(client));

// 👇 서버 실행은 딱 한 번만
app.listen(3000, () => {
  console.log('Server running on 3000');
});

client.login(process.env.DISCORD_TOKEN);


client.on('clientReady', async () => {
  console.log('봇 로그인 완료');
  const guild = client.guilds.cache.first();
  if (!guild) return;

  await guild.members.fetch();

  const data = loadData();

  guild.members.cache.forEach(member => {
    const userId = member.id;

    if (!data.users[userId]) data.users[userId] = {};

    data.users[userId].avatar = member.user.displayAvatarURL({ size: 128 });
    data.users[userId].nickname = member.displayName;
  });

  saveData(data);
  
});


let dirty = false;

function markDirty() {
  dirty = true;
}

setInterval(() => {
const data = loadData();
  if (dirty) {
    saveData(data);
    dirty = false;
  }
}, 5000);


function computeTodayWeekAll(user) {
  const now = Date.now();
  const todayStart = kstStartOfTodayMs(now);

  const day = new Date(now).getDay(); // 0=일
  const diff = day === 0 ? 6 : day - 1;
  const weekStart = todayStart - diff * DAY_MS;

  let todaysec = 0;
  let weekSec = 0;

  for (const s of user.sessions || []) {
    const start = Date.parse(s.start);
    const end = Date.parse(s.end);
    todaysec += overlapSeconds(start, end, todayStart, todayStart + DAY_MS);
    weekSec += overlapSeconds(start, end, weekStart, now);
  }

  if (user.currentStart) {
    todaysec += overlapSeconds(user.currentStart, now, todayStart, todayStart + DAY_MS);
    weekSec += overlapSeconds(user.currentStart, now, weekStart, now);
  }

  return {
    todaysec: Math.floor(todaysec),
    weekSec: Math.floor(weekSec),
    allSec: user.totalSeconds || 0,
  };
}

client.on('presenceUpdate', (oldState, newState) => {
  const member = newState.member;
  if (!member) return;

  const userId = member.id;
  const data = loadData();

  if (!data.users[userId]) data.users[userId] = {};

  data.users[userId].nickname = member.displayName;
data.users[userId].avatar = member.user.displayAvatarURL({ size: 128 });

markDirty();   // saveData ❌ 대신 이거


  
});




client.on("voiceStateUpdate", (oldState, newState) => {
console.log("ENV STUDY:", process.env.STUDY_VC_ID);
  const userId = newState.id;
  const data = loadData();

  if (!data.users || !data.users[userId]) return;

  const STUDY_VC_ID = process.env.STUDY_VC_ID;

  const isInStudy = newState.channelId === STUDY_VC_ID;

  // 🎥 캠이 OFF → ON으로 바뀐 순간
  if (!oldState.selfVideo && newState.selfVideo && isInStudy) {
    data.users[userId].currentStart = Date.now();
    saveData(data);
    console.log("캠 ON → 온라인:", userId);
  }

  // 📷 캠이 ON → OFF로 바뀐 순간
  if (oldState.selfVideo && !newState.selfVideo) {
    data.users[userId].currentStart = null;
    saveData(data);
    console.log("캠 OFF → 오프라인:", userId);
  }

   /* =========================
       2️⃣ 캠 ON / OFF 로그 (독립)
    ========================= */
    if (!oldVideo && newVideo) {
      logCh.send(`📷 ${usertag} 캠 ON`);
    }

    if (oldVideo && !newVideo) {
      logCh.send(`📷 ${usertag} 캠 OFF`);
    }

console.log("newChannel:", newState.channelId, "study:", STUDY_VC_ID);
});
 

client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;

  const content = msg.content.trim();

  const data = loadData();
  const userId = msg.author.id;

  // ===== !help =====
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

  // 유저 데이터 없으면 여기서 생성
  if (!data.users[userId]) {
    data.users[userId] = {
      nickname,
      todayseconds: 0,
      sessions: [],
      currentStart: null,
      currentChannelId: null,
      goaltodaysec: 0,
      attendance: { lastDay: null, streak: 0, days: {} },
    };
    saveData(data);
  }

  const user = data.users[userId];

  // ===== !time =====
  if (content === '!time') {
    const {todaysec, weekSec, allSec } = computeTodayWeekAll(u);
    await msg.reply(
      `🕒 ${user.usertag}\n` +
      `- 오늘: ${formatSeconds(todaysec)}\n` +
      `- 이번주: ${formatSeconds(weekSec)}\n` +
      `- 누적: ${formatSeconds(allSec)}`
    );
    return;
  }

  // ===== !today =====
  if (content.startsWith('!today')) {
    const { todaysec, weekSec, allSec } = computeTodayWeekAll(user);
    await msg.reply(`📅 오늘 공부: ${formatSeconds(todaysec)}`);
    return;
  }

  // ===== !week =====
  if (content.startsWith('!week')) {
    const { weekSec } = computeTodayWeekAll(u);
    await msg.reply(`📆 이번 주: ${formatSeconds(weekSec)}`);
    return;
  }

  // ===== !goal =====
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



