
const express = require('express');
const { loadData, saveData } = require('../data/store');

module.exports = function createAdminRouter(client) {

  const router = express.Router();
    
const defaultAvatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
const getDefaultAvatar = (userId) => {
  const index = Number(userId) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
};


const USER_REGISTRY = [
    { nickname: "날" }, { nickname: "부계 날" }, { nickname: "탐" },
    { nickname: "망난" }, { nickname: "나은" }, { nickname: "하늘" },
    { nickname: "믕" }, { nickname: "말감이" }, { nickname: "y" },
    { nickname: "라해" }, { nickname: "능솨" }, { nickname: "노란동그라밍" },
    { nickname: "담요" }, { nickname: "라오타" }, { nickname: "일영" },
    { nickname: "므엥이" }, { nickname: "꿍냐" }, { nickname: "귤" },
    { nickname: "빙수" }
];


router.get('/today', (req, res) => {
  const data = loadData();


  const users = Object.entries(data).map(([userId, user]) => {
    const goalSec = user.goalSec ?? 3600;
    const totalSec = user.totalSeconds ?? 0;

    return {
      id: userId,
     name: user.nickname || user.username || userId,
    aavatar: member.user.displayAvatarURL({ size: 128 }),
      progress: Math.min(100, Math.floor(totalSec / goalSec * 100)),
      isStudying: !!user.currentStart
    };
  });

  res.json({ users });
});


router.get('/weekly', (req, res) => {
  try {
    const data = loadData();
    const result = [];

    Object.entries(data).forEach(([userId, user]) => {
      if (!user.sessions) return;

      user.sessions.forEach(s => {
        const dayKey = s.start?.slice(0, 10);
        if (!dayKey) return;

        let day = result.find(d => d.dayKey === dayKey);
        if (!day) {
          day = { dayKey, totalSec: 0, users: [] };
          result.push(day);
        }

        day.totalSec += s.seconds || 0;

        // 같은 날 같은 유저는 한 번만 (실제 인장 한 명당 하나)
        if (!day.users.some(u => u.id === userId)) {
          day.users.push({
            id: userId,
           name: user.nickname || user.usertag || user.username || userId,
            avatar:member.user.displayAvatarURL({ size: 128 }),
            seconds: s.seconds || 0
          });
        }
      });
    });

    res.json({ days: result });
  } catch (err) {
    res.status(500).json({ error: "서버 오류" });
  }
});

router.get('/dashboard', (req, res) => {
  try {
    const data = loadData();

    const users = Object.entries(data).map(([userId, user]) => {
      const goalSec = user.goalSec ?? 3600;

      return {
        id: userId,
        name: user.nickname || user.username || userId,
        avatar: member.user.displayAvatarURL({ size: 128 }),
        totalSec: user.totalSeconds || 0,
        goalSec,
        streak: user.attendance?.streak || 0,
        badge:
          (user.attendance?.streak || 0) >= 7
            ? "🔥 7일 달성"
            : null,
        online: !!user.currentStart
      };
    });

    res.json({ users });

  } catch (err) {
    res.status(500).json({ err : "서버 오류" });
  }
});




// 🔹 DAYS (total용)
router.get('/days', (req, res) => {
  try {
    const data = loadData();
    const result = [];

    Object.entries(data).forEach(([userId, user]) => {
      if (!user.sessions) return;

      user.sessions.forEach(s => {
        const dayKey = s.start?.slice(0, 10);
        if (!dayKey) return;

        let day = result.find(d => d.dayKey === dayKey);
        if (!day) {
          day = { dayKey, totalSec: 0, users: [] };
          result.push(day);
        }

        day.totalSec += s.seconds || 0;

        if (!day.users.some(u => u.id === userId)) {
          day.users.push({
            id: userId,
            name: user.nickname || user.usertag || user.username || userId,
            avatar: member.user.displayAvatarURL({ size: 128 }),
            seconds: s.seconds || 0
          });
        }
      });
    });

    res.json({ days: result });
  } catch (err) {
    res.status(500).json({ err: "서버 오류" });
  }
});



// [기록 삭제] 보내주신 기존 함수를 조금 더 안전하게 보강
router.post('/session/delete', (req, res) => { // fetch에서 POST로 보낼 경우 대비
    const { userId, index } = req.body;
    const data = loadData();
   

    if (data[userId] && data[userId].sessions) {
        data[userId].sessions.splice(index, 1);
        saveData(data);
        res.json({ ok: true });
    } else {
        res.status(404).json({ ok: false, error: "데이터를 찾을 수 없음" });
    }
});

router.post('/edit-session', (req, res) => {

  const { userId, index, newSeconds, editTime } = req.body;
  const data = loadData();

  const user = data[userId];

  if (user && user.sessions && user.sessions[index]) {

    user.sessions[index].seconds = newSeconds;
    user.sessions[index].lastEdit = editTime;

    saveData(data);

    res.json({ ok: true });

  } else {
    res.status(404).json({ ok: false });
  }

});

// 🔹 MYPAGE

router.get('/mypage', (req, res) => {
  const data = loadData();

  const finalUsers = Object.entries(data).map(([userId, user]) => {
    return {
      id: userId,
      name: user.nickname || user.usertag || user.username || userId,
      badge:
        (user.attendance?.streak || 0) >= 7
          ? "🔥 7일 달성"
          : null,
      avatar: member.user.displayAvatarURL({ size: 128 }),
      totalSec: user.totalSeconds || 0,
      goalSec: user.goalSec ?? 3600,
      streak: user.attendance?.streak || 0,
      online: !!user.currentStart
    };
  });

  res.json({ finalUsers });
});






router.get('/manual-data', (req, res) => {
  const data = loadData();
  const finalUsers = Object.entries(data).map(([userId, user]) => ({
    id: userId,
    name: user.nickname || user.usertag || user.username || userId,
    nickname: user.nickname || user.usertag || user.username,
    usertag: user.usertag,
    sessions: user.sessions || [],
    totalSeconds: user.totalSeconds,
    // 필요하면 avatar 등 추가
  }));
  res.json({ finalUsers });
});

router.post('/manual-data', (req, res) => {
  const { userId, minutes } = req.body;
  const data = loadData();

  if (!data[userId]) {
    data[userId] = {
      nickname: userId,
      avatar: null,
      sessions: []
    };
  }

  if (!data[userId].sessions) {
    data[userId].sessions = [];
  }

  data[userId].sessions.push({
    seconds: Number(minutes) * 60,
    manual: true,
    start: new Date().toISOString(),
end: new Date().toISOString(),
  });

  saveData(data);
  res.json({ ok: true });
});

router.post('/memo', (req, res) => {
  const { userId, memo } = req.body;

  const data = loadData();

  if (!data[userId]) {
    return res.status(404).json({ error: "유저 없음" });
  }

  data[userId].memo = memo;

  saveData(data);

 res.json({ success: true });

});

return router; 
// 👈 여기서 전체 함수를 닫음 (이미지 하단에 보이던 괄호의 정체)
}