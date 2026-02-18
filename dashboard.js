
require('dotenv').config();
const fs = require('fs');
const PORT = 3000; 
const { loadData } = require('./data/store');


const express = require('express');
const path = require('path');


module.exports = function startDashboardServer(client) {
console.log("client 들어옴?", !!client);
  const app = express();
 
  app.locals.client = client; // ⭐ 이거 중요
const createAdminRouter = require('./routes/admin');
  app.use(express.json());
  app.use(express.static('public'));
  app.use('/', createAdminRouter(client));
  console.log("createAdminRouter:", createAdminRouter);

  
  
  

  

  // --- [페이지 서빙 (HTML)] ---
  app.get('/manual', (req, res) => res.sendFile(path.join(__dirname, 'public', 'manual.html')));
  app.get('/mypage', (req, res) => res.sendFile(path.join(__dirname, 'public', 'mypage.html')));
  app.get('/today-page', (req, res) => res.sendFile(path.join(__dirname, 'public', 'today.html')));
  app.get('/days-page', (req, res) => res.sendFile(path.join(__dirname, 'public', 'days.html'))); // 중복 방지를 위해 이름 변경
  app.get('/total', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'total.html'));
});
  // --- [데이터 API (JSON)] ---

  // 요약 정보
  app.get('/summary', (req, res) => {
    const discordClient = req.app.locals.client;
    res.json({
      guilds: discordClient?.guilds?.cache?.size || 0,
      finalUsers: discordClient?.finalUsers?.cache?.size || 0,
    });
  });

 

  
 



  app.post('/manual', (req, res) => {
    try {
        console.log("🔥 manual POST 들어옴");
        console.log("body:", req.body);

        const { userId, minutes } = req.body;

        const data = loadData();

        console.log("현재 data keys:", Object.keys(data));
        console.log("받은 userId:", userId);

        if (!data[userId]) {
            console.log("❌ 유저 없음");
            return res.status(404).json({ error: '유저 없음' });
        }

        if (!data[userId].sessions) {
            data[userId].sessions = [];
        }

        const now = new Date().toISOString();

        data[userId].sessions.push({
            start: now,
            end: now,
            seconds: Number(minutes) * 60,
            manual: true
        });

        saveData(data);

        console.log("✅ 저장 완료");

        res.json({ ok: true });

    } catch (err) {
        console.error("💥 manual 에러:", err);
        res.status(500).json({ error: "서버 에러" });
    }
});

  // 서버 시작
 const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0');

}