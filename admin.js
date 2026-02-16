
const express = require('express');
const { loadData, saveData } = require('./data/store');

module.exports = function createAdminRouter(client) {

  const router = express.Router();
    




router.get("/today", (req, res) => {
  try {
    const data = loadData();

    const finalUsers = Object.entries(data).map(([userId, user]) => ({
      id: userId,
      name: user.nickname || userId,
      avatar: user.avatar || null,
      totalSec: user.totalSeconds || 0,
      goalSec: user.goalSec ?? 3600,
      streak: user.attendance?.streak || 0,
      badge:
        (user.attendance?.streak || 0) >= 7
          ? "🔥 7일 달성"
          : null,
      online: !!user.currentStart
    }));

    res.json({ finalUsers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
});
  



 router.get('/weekly', (req, res) => {
  const data = loadData();
  res.json({ finalUsers: Object.values(data) });
});

router.get('/dashboard', (req, res) => {
  try {
    const data = loadData();

    const users = Object.entries(data).map(([userId, user]) => {
      const goalSec = user.goalSec ?? 3600;

      return {
        id: userId,
        name:
          user.nickname ||
          user.userTag ||
          user.username ||
          userId,

        avatar: user.avatar || null,
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
    res.status(500).json({ error: "서버 오류" });
  }
});



// 🔹 DAYS
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
          [
  {
    dayKey: "2026-02-13",
    totalSec: 3600,
    users: [ userId1, userId2 ]
  }
]
          result.push(day);
        }

        day.totalSec += s.seconds || 0;
dayKey,
        day.users.push({
  id: userId,
  name: user.nickname || userId,
  avatar: user.avatar || null,
  seconds: s.seconds || 0
});
      });
    });

    res.json({ days: result });

  } catch (err) {
    res.status(500).json({ err: "서버 오류" });
  }
});;

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
      name:
        user.nickname ||
        user.userTag ||
        user.username ||
        userId,

      badge:
        (user.attendance?.streak || 0) >= 7
          ? "🔥 7일 달성"
          : null,

      avatar: user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png',
      totalSec: user.totalSeconds || 0,
      goalSec: user.goalSec ?? 3600,
      streak: user.attendance?.streak || 0,
      online: !!user.currentStart
    };
  });

  res.json({ finalUsers });
});



// 🔹 MANUAL 저장 (POST)
  router.post('/manual', (req, res) => {
   
    if (!data[userId].sessions) {
  data[userId].sessions = [];
}

    const now = new Date().toISOString();
 const { userId, minutes } = req.body;
const data = loadData();
    data[userId].sessions.push({
      start: now,
      end: now,
      seconds: Number(minutes) * 60,
      manual: true
    });
    saveData(data);

    res.json({ success: true });
 });



router.get('/manual-data', (req, res) => {
  const data = loadData();

  res.json({ finalUsers: Object.values(data) });
});




router.post('/manual-data', (req, res) => {
  const { userId, minutes } = req.body;
  const data = loadData();

  if (!data[userId]) {
    data[userId] = {};
  }

  if (!data[userId].sessions) {
    data[userId].sessions = [];
  }

  data[userId].sessions.push({
   seconds: Number(minutes) * 60,
    manual: true,
    start: new Date().toISOString()
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