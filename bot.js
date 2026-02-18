require('dotenv').config();


const startDashboardServer = require('./dashboard');
const { loadData, saveData } = require('./data/store');
const {
  Client,
  GatewayIntentBits,
  Partials
} = require("discord.js");


  
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.GuildMember]
});

// client.on('ready', async () => {
//   console.log('봇 로그인 완료');




//   const guild = client.guilds.cache.first();
//   if (!guild) return;

//   await guild.members.fetch();

//   const data = loadData();

//   guild.members.cache.forEach(member => {
//     const userId = member.id;

//     if (!data[userId]) data[userId] = {};

//     data[userId].avatar = member.user.displayAvatarURL({ size: 128 });
//     data[userId].nickname = member.displayName;
//   });

//   saveData(data);
//   console.log("초기 인장 저장 완료");
// });


let dirty = false;

function markDirty() {
  dirty = true;
}

setInterval(() => {
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

  if (!data[userId]) data[userId] = {};

  data[userId].nickname = member.displayName;
data[userId].avatar = member.user.displayAvatarURL({ size: 128 });

// markDirty();   // saveData ❌ 대신 이거


  
});

s


client.on("voiceStateUpdate", (oldState, newState) => {
console.log("voiceStateUpdate fired");
  const member = newState.member || oldState.member;
  if (!member) return;

  const data = loadData();
  const userId = member.id;

data[userId].nickname = member.displayName;
data[userId].avatar = member.user.displayAvatarURL({ size: 128 });

  if (!data[userId]) data[userId] = {};

 

console.log(
  `[VOICE] ${member.displayName}`,
  'oldVideo:', oldState.selfVideo,
  'newVideo:', newState.selfVideo,
  'oldCh:', oldState.channelId,
  'newCh:', newState.channelId
);

  try {
   

    
const usertag = member.displayName;
    const oldVideo = oldState.selfVideo;
    const newVideo = newState.selfVideo;

    const oldChId = oldState.channelId;
    const newChId = newState.channelId;

    const STUDY_VC_ID = process.env.STUDY_VC_ID;
    const logCh = client.channels.cache.get(process.env.LOG_CHANNEL_ID);

    if (!logCh) return;



    // 유저 데이터 보장
    if (!data[userId]) {
     data[userId] = {
      nickname: msg.member?.displayName || msg.author.username,
 avatar: member.user.displayAvatarURL({ size: 128 }),

      todayseconds: 0,
      sessions: [],
      currentStart: null,
      currentChannelId: null,
    };



    }

    /* =========================
       1️⃣ STUDY 입장 + 캠 ON
    ========================= */
    const enteredStudy =
      oldChId !== STUDY_VC_ID &&
      newChId === STUDY_VC_ID &&
      newVideo === true;

    if (enteredStudy && !data[userId].currentStart) {
      data[userId].currentStart = Date.now();
      data[userId].currentChannelId = STUDY_VC_ID;
      saveData(data);

      logCh.send(`🎥 ${usertag} STUDY 입장 + 캠 ON`);
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

  } catch (e) {
    console.error('❌ voiceStateUpdate error:', e);
  }
// markDirty();   // saveData ❌ 대신 이거

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
  if (!data[userId]) {
    data[userId] = {
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

  const user = data[userId];

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


startDashboardServer(client);
// client.login(process.env.DISCORD_TOKEN);
