
const express = require('express');
const { loadData, saveData } = require('../data/store');

module.exports = function createAdminRouter(client) {
console.log("ADMIN ROUTER LOADED");
  const router = express.Router();





const USER_REGISTRY = [
    { nickname: "날" }, { nickname: "부계 날" }, { nickname: "탐" },
    { nickname: "망난" }, { nickname: "나은" }, { nickname: "하늘" },
    { nickname: "믕" }, { nickname: "말감이" }, { nickname: "y" },
    { nickname: "라해" }, { nickname: "능솨" }, { nickname: "노란동그라밍" },
    { nickname: "담요" }, { nickname: "라오타" }, { nickname: "일영" },
    { nickname: "므엥이" }, { nickname: "꿍냐" }, { nickname: "귤" },
    { nickname: "빙수" }
];


router.get("/today", (req, res) => {

  const token = req.query.token;
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: "invalid token" });
  }

  try {

const data = loadData();

const usersData = data.users || {};
const result = {};

Object.entries(usersData).forEach(([userId, user]) => {
result[userId] = {
  id: userId,
  name: user.nickname || "알 수 없음",
  avatar: user.avatar,
  seconds: 0,
  online: user.currentStart ? true : false,
  sessions: user.sessions || [],        // 🔥 추가
  totalSeconds: user.totalSeconds || 0  // 🔥 추가

};
});

res.json({
  users: result,
  feed: data.feed || []
});

  } catch (err) {
    console.error("❌ today 라우터 오류:", err);
    res.status(500).json({ error: "server error" });
  }

});


// --- Weekly 라우터 수정 ---
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
          day = { dayKey, totalSeconds: 0, users: [] };
          result.push(day);
        }

        let existingUser = day.users.find(u => u.id === userId);
        if (!existingUser) {
          day.users.push({
            id: userId, // 클릭 이벤트를 위해 ID 필수!
            name: user.nickname || user.usertag || user.username || userId,
            avatar: user.avatar ,
            seconds: s.seconds || 0 // 처음 세션 시간 할당
          });
        } else {
          existingUser.seconds += (s.seconds || 0); // 기존 시간에 합산
        }
        day.totalSeconds += (s.seconds || 0);
      });
    });
    res.json({ days: result });
  } catch (err) {
    res.status(500).json({ error: "서버 오류" });
  }
});




router.get("/dashboard", (req, res) => {
  const token = req.query.token;

  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: "invalid token" });
  }

  const data = loadData() || {};

  const finalUsers = Object.entries(data).map(([userId, user]) => ({
    id: userId,
    name: user.nickname || user.usertag || user.username || userId,
    badge: (user.attendance?.streak || 0) >= 7 ? "🔥 7일 달성" : null,
    avatar: user.avatar,
    totalSeconds: user.totalSeconds || 0,
    goalSec: user.goalSec ?? 3600,
    streak: user.attendance?.streak || 0,
    online: !!user.currentStart,
    sessions: user.sessions || [],
  }));

  return res.json({ users: finalUsers });
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
          day = { dayKey, totalSeconds: 0, users: [] };
          result.push(day);
        }

        day.totalSeconds += s.seconds || 0;

        if (!day.users.some(u => u.id === userId)) {
          day.users.push({
            id: userId,
            name: user.nickname || user.usertag || user.username || userId,
             avatar: user.avatar ,
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


// 세션 삭제
router.post('/delete-session', (req, res) => {
  const { token, userId, index } = req.body;

  console.log("🔍 삭제 요청 받음:");
  console.log("  token:", token ? "있음" : "없음");
  console.log("  index:", index, typeof index);

  // 토큰 체크
  if (token !== process.env.ADMIN_TOKEN) {
    console.error("❌ 토큰 불일치");
    return res.status(403).json({ ok: false, error: "Invalid token" });
  }

  const data = loadData();
  console.log("📂 현재 데이터의 유저 목록:", Object.keys(data));

  // userId가 데이터에 있는지 확인
  if (!data.users[userId]) {
    console.error(`❌ 유저를 찾을 수 없음: ${userId}`);
    console.log("  사용 가능한 유저:", Object.keys(data));
    return res.status(404).json({ 
      ok: false, 
      error: "User not found",
      availableUsers: Object.keys(data)
    });
  }

  // 세션 배열이 있는지 확인
  if (!data.users[userId].sessions) {
    console.error(`❌ 유저(${userId})에게 세션 배열이 없음`);
    return res.status(404).json({ ok: false, error: "No sessions array" });
  }

  // 인덱스가 유효한지 확인
  if (index < 0 || index >= data.users[userId].sessions.length) {
    console.error(`❌ 잘못된 인덱스: ${index} (전체 세션 수: ${data.users[userId].sessions.length})`);
    return res.status(404).json({ 
      ok: false, 
      error: "Invalid index",
      sessionCount: data.users[userId].sessions.length
    });
  }

  // 삭제 전 로그
  console.log(`🗑️ 삭제할 세션:`, data.users[userId].sessions[index]);
  
  // 세션 삭제
  data.users[userId].sessions.splice(index, 1);
  
  saveData(data);
  console.log(`✅ 삭제 완료: ${userId}의 세션 ${index}번`);
  
  return res.json({ ok: true });
});

// 세션 수정
router.post('/edit-session', (req, res) => {
  const { token, userId, index, newSeconds, editTime } = req.body;

  console.log("🔍 수정 요청 받음:");
  console.log("  token:", token ? "있음" : "없음");
  console.log("  index:", index, typeof index);
  console.log("  newSeconds:", newSeconds);

  // 토큰 체크
  if (token !== process.env.ADMIN_TOKEN) {
    console.error("❌ 토큰 불일치");
    return res.status(403).json({ ok: false, error: "Invalid token" });
  }

  const data = loadData();
  const user = data.find(u => u.id === userId);

  if (!user) {
    console.error(`❌ 유저를 찾을 수 없음: ${userId}`);
    return res.status(404).json({ 
      ok: false, 
      error: "User not found",
      availableUsers: Object.keys(data)
    });
  }

  if (!user.sessions) {
    console.error(`❌ 유저(${userId})에게 세션 배열이 없음`);
    return res.status(404).json({ ok: false, error: "No sessions array" });
  }

  if (index < 0 || index >= user.sessions.length) {
    console.error(`❌ 잘못된 인덱스: ${index}`);
    return res.status(404).json({ 
      ok: false, 
      error: "Invalid index",
      sessionCount: user.sessions.length
    });
  }

  // 수정 전 로그
  console.log(`✏️ 수정 전:`, user.sessions[index]);
  
  // 세션 수정
  user.sessions[index].seconds = Number(newSeconds);
  user.sessions[index].lastEdit = editTime || new Date().toISOString();
  
  saveData(data);
  console.log(`✅ 수정 완료:`, user.sessions[index]);
  
  res.json({ ok: true });
});

// 🔹 MYPAGE

router.get('/mypage', (req, res) => {
  try {
    const data = loadData() || {};

    const finalUsers = Object.entries(data).map(([userId, user = {}]) => ({
      id: userId,
      name: user.nickname || user.usertag || user.username || userId,
      badge:
        (user.attendance?.streak ?? 0) >= 7
          ? "🔥 7일 달성"
          : null,
      avatar: user.avatar || null,
      totalSeconds: user.totalSeconds || 0,
      goalSec: user.goalSec ?? 3600,
      streak: user.attendance?.streak ?? 0,
      online: !!user.currentStart
    }));

    console.log("MYPAGE RESPONSE:", finalUsers); // 여기로 이동

    res.json(finalUsers);

  } catch (err) {
    console.error("MYPAGE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});






// 서버 라우터 코드
router.get('/manual-data', (req, res) => {
console.log("🔥 manual-data GET 호출됨");
  const token = req.query.token;

  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: "Invalid token" });
  }

  const data = loadData();
  const users = data.users || {};
console.log("GET에서 읽은 데이터:", data.users);

console.log("GET에서 읽은 users:", data.users);
  const result = Object.entries(users).map(([userId, user]) => ({
    id: userId,
    name: user.nickname || userId,
    avatar: user.avatar || null,
    sessions: user.sessions || [],
    totalSeconds: user.totalSeconds || 0
  }));

  res.json(result);
});

router.post('/manual-data', (req, res) => {

  const { token, userId, minutes } = req.body;

  // 토큰 체크
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ ok: false, error: "Invalid token" });
  }

  const data = loadData();
console.log("저장 직전 데이터:", data.users[userId]);

console.log("GET에서 읽은 users:", data.users);
  if (!data.users[userId]) {
    data.users[userId] = {
      nickname: userId,
      avatar: null,
      sessions: [],
      totalSeconds: 0
    };
  }

  if (!data.users[userId].sessions) {
    data.users[userId].sessions = [];
  }

  const newSession = {
    seconds: Number(minutes) * 60,
    manual: true,
    start: new Date().toISOString(),
    end: new Date().toISOString(),
  };

  data.users[userId].sessions.push(newSession);

  // totalSeconds 업데이트
  data.users[userId].totalSeconds = (data.users[userId].totalSeconds || 0) + newSession.seconds;

  saveData(data);
  console.log(`✅ 수동 세션 추가: ${userId}에게 ${minutes}분 추가됨`);

  res.json({ ok: true });
});



router.post('/memo', (req, res) => {
  const { userId, memo } = req.body;

  const data = loadData();

  if (!data.users[userId]) {
    return res.status(404).json({ error: "유저 없음" });
  }

  data.users[userId].memo = memo;

  saveData(data);

 res.json({ success: true });

});

router.get('/save-memo', (req, res) => {
  // 1. 프론트엔드에서 보낸 쿼리 파라미터들 추출
  const { token, userId, memo } = req.query; 

  // 2. 토큰 검증 (process.env.ADMIN_TOKEN과 비교)
  if (token !== process.env.ADMIN_TOKEN) {
    console.error("❌ 토큰 불일치");
    return res.status(403).json({ error: "invalid token" });
  }

  // 3. 데이터 로드 및 저장
  const data = loadData();
  
  // 여기서 userId가 정확히 매칭되어야 합니다 (data.users[userId] 체크)
  if (userId && data.users[userId]) {
    data.users[userId].memo = memo;
    saveData(data);
    console.log(`✅ 메모 저장 완료: [${userId}] -> ${memo}`);
    return res.json({ success: true });
  } else {
    console.error(`❌ 유저를 찾을 수 없음: ID [${userId}]`);
    return res.status(404).json({ error: "user not found or invalid id" });
  }
});



// 임시 디버깅 라우트 추가
router.get('/debug-data', (req, res) => {
  const { token } = req.query;
  
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: "Invalid token" });
  }

  const data = loadData();
  
  // 데이터 구조 분석
  const analysis = Object.entries(data).map(([userId, user]) => ({
    userId,
    hasSessions: !!user.sessions,
    sessionCount: user.sessions ? user.sessions.length : 0,
    sessions: user.sessions || []
  }));

  res.json(analysis);
});






router.get('/save-feed', (req, res) => {
console.log(req.query);


let { token, nickname, memo } = req.query;

if (Array.isArray(token)) {
  token = token[0];
}

 if (token !== process.env.ADMIN_TOKEN) {
  return res.status(403).json({ error: "invalid token" });
}

  if (!nickname || !memo) {
    return res.status(400).json({ error: "missing params" });
  }

  const data = loadData();

  if (!data.users) data.users = {};
  if (!data.feed) data.feed = [];

  // 🔥 nickname → userId 찾기
  const userEntry = Object.entries(data.users).find(
  ([id, user]) =>
    user.nickname === nickname ||
    user.name === nickname
);
 if (!userEntry) {
  console.log("유저 못 찾음. users:", data.users);
  return res.status(400).json({ error: "user not found" });
}
  const userId = userEntry[0];

  data.feed.unshift({
    id: Date.now(),
    userId,
    nickname,
    text: memo,
    createdAt: Date.now()
  });

  saveData(data);


  res.json({ ok: true });
});



router.get("/delete-feed", (req, res) => {

  let { token, id, nickname } = req.query;

  if (Array.isArray(token)) token = token[0];

  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: "invalid token" });
  }

  const idNum = Number(id);
  const data = loadData();

  if (!data.feed) data.feed = [];

  data.feed = data.feed.filter(item =>
    !(item.id === idNum && item.nickname === nickname)
  );

  saveData(data);

  res.json({ success: true });
});






return router; 



}