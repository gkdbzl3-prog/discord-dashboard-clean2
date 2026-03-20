const express = require("express");
const { loadData, saveData } = require("../data/store");
const {
  normalizeDataRoot,
  resolveGuildIdFromRequest,
  ensureGuild,
  listGuilds
} = require("../data/guild-data");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");
  const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

module.exports = function createAdminRouter(client) {



const ALLOWED_GUILDS = [
  "각할모_서버_ID",
  "테스트_서버_ID"
];

function isGuildAccessInvalid(req, guild) {
  const accessKey = String(req.query.accessKey || req.body?.accessKey || "");
  const expected = String(guild?.settings?.accessKey || "");
  return !expected || accessKey !== expected;
}


  function readContext(req) {
    const data = normalizeDataRoot(loadData() || {});
    const guildId = resolveGuildIdFromRequest(req, data);
    const guild = ensureGuild(data, guildId);
    return { data, guildId, guild };
  }

  function isTokenInvalid(req) {
    const token = req.query?.token || req.body?.token;
    return !!(token && token !== process.env.ADMIN_TOKEN);
  }

  function userNameOf(user, userId) {
    return user?.nickname || user?.name || user?.username || userId;
  }

  function secondsOf(s) {
    const direct = Number(s?.seconds || 0);
    if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
    const startMs = typeof s?.start === "number" ? s.start : new Date(s?.start).getTime();
    const endMs = typeof s?.end === "number" ? s.end : new Date(s?.end).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      return Math.floor((endMs - startMs) / 1000);
    }
    return 0;
  }

  function aggregateSessions(sessions) {
    const list = Array.isArray(sessions) ? sessions : [];
    const hasTagged = list.some((s) => typeof s?.source === "string");
    if (!hasTagged) return list;
    return list.filter((s) => !s?.source || s?.source === "camera_event" || s?.source === "manual" || s?.manual === true);
  }

  function aggregateTotalSeconds(user) {
    return aggregateSessions(user?.sessions).reduce((sum, s) => sum + secondsOf(s), 0);
  }

  function normalizeFeed(feed = []) {
    const list = Array.isArray(feed) ? feed : [];
    const milestoneSeen = new Set();
    const out = [];

    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const text = String(raw.text ?? "").trim();
      const image = raw.image ? String(raw.image).trim() : "";
      const safeText = /^undefined$/i.test(text) ? "" : text;
      if (!safeText && !image) continue;

      const createdAt = Number(raw.createdAt || Date.now());
      const userId = String(raw.userId || "");
      const isFiveHour = /오늘\s*5시간\s*달성/.test(safeText);

      if (isFiveHour) {
        const d = new Date(createdAt);
        const dayKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        const key = `${userId}|${dayKey}|${safeText}`;
        if (milestoneSeen.has(key)) continue;
        milestoneSeen.add(key);
      }

      out.push({
        ...raw,
        text: safeText,
        image: image || null,
        createdAt
      });

      if (out.length >= 400) break;
    }

    return out;
  }

  function dedupeManualSessionsInPlace(user, thresholdMs = 10000) {
    const sessions = Array.isArray(user?.sessions) ? user.sessions : [];
    const manualRows = sessions
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => s?.manual === true || s?.source === "manual")
      .map(({ s, idx }) => {
        const st = typeof s?.start === "number" ? s.start : new Date(s?.start).getTime();
        return { idx, st, sec: secondsOf(s) };
      })
      .filter((x) => Number.isFinite(x.st) && x.sec > 0)
      .sort((a, b) => a.st - b.st);

    const removeSet = new Set();
    for (let i = 1; i < manualRows.length; i++) {
      const prev = manualRows[i - 1];
      const cur = manualRows[i];
      if (prev.sec === cur.sec && Math.abs(cur.st - prev.st) <= thresholdMs) {
        removeSet.add(cur.idx);
      }
    }
    if (removeSet.size === 0) return false;

    user.sessions = sessions.filter((_, idx) => !removeSet.has(idx));
    user.totalSeconds = aggregateTotalSeconds(user);
    return true;
  }

  function manualSortMs(session) {
    const editMs = Date.parse(session?.editTime || session?.lastEdit || "");
    if (Number.isFinite(editMs) && editMs > 0) return editMs;
    const startMs = typeof session?.start === "number" ? session.start : Date.parse(session?.start);
    if (Number.isFinite(startMs) && startMs > 0) return startMs;
    const endMs = typeof session?.end === "number" ? session.end : Date.parse(session?.end);
    if (Number.isFinite(endMs) && endMs > 0) return endMs;
    return 0;
  }

  function formatDayKeyLocal(ms) {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function saveImageToLocal(file) {
    if (!file?.buffer) return null;
    const uploadDir = path.join(__dirname, "..", "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const ext = path.extname(file.originalname || "") || ".png";
    const filename = `${Date.now()}${ext}`;
    const abs = path.join(uploadDir, filename);
    fs.writeFileSync(abs, file.buffer);
    return `/uploads/${filename}`;
  }

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
  });

  function sendGuildList(req, res) {
    if (isTokenInvalid(req)) {
      return res.status(403).json({ error: "invalid token" });
    }
    const { data, guildId } = readContext(req);
    const guilds = listGuilds(data).map((g) => ({
      id: g.guildId,
      name: g.guildId
    }));
    res.json({ guildId, guilds });
  }

  function sendToday(req, res) {
    if (isTokenInvalid(req)) {
      return res.status(403).json({ error: "invalid token" });
    }

    try {
      const { data, guild, guildId } = readContext(req);
      const result = {};

      Object.entries(guild.users || {}).forEach(([userId, user]) => {
        result[userId] = {
          id: userId,
          name: userNameOf(user, userId),
          avatar: user?.avatar || null,
          seconds: Number(user?.seconds || 0),
          online: !!user?.currentStart,
          currentStart: user?.currentStart || null,
          sessions: Array.isArray(user?.sessions) ? user.sessions : [],
          totalSeconds: aggregateTotalSeconds(user),
          freeGoals: Array.isArray(user?.freeGoals) ? user.freeGoals : [],
          studyRecords: Array.isArray(user?.studyRecords) ? user.studyRecords : [],
          memo: user?.memo || ""
        };
      });

      const normalizedFeed = normalizeFeed(guild.feed);
      if (normalizedFeed.length !== (Array.isArray(guild.feed) ? guild.feed.length : 0)) {
        guild.feed = normalizedFeed;
        saveData(data);
      }

      res.json({
        guildId,
        users: result,
        feed: normalizedFeed,
        settings: guild.settings || {}
      });
    } catch (err) {
      console.error("/today error", err);
      res.status(500).json({ error: "server error" });
    }
  }







  router.get("/guilds", sendGuildList);
  router.get("/admin/guilds", sendGuildList);
  router.get("/today", sendToday);
  router.get("/admin/today", sendToday);


router.get("/today", (req, res) => {
  if (isTokenInvalid(req)) {
    return res.status(403).json({ error: "invalid token" });
  }

  const { data, guild, guildId, error } = getGuildContext(req);
  if (error) {
    return res.status(400).json({ error });
  }

  if (!ALLOWED_GUILDS.includes(guildId)) {
    return res.status(403).json({ error: "guild not allowed" });
  }

  if (isGuildAccessInvalid(req, guild)) {
    return res.status(403).json({ error: "invalid guild access" });
  }

  if (isTokenInvalid(req)) {
    return res.status(403).json({ error: "invalid token" });
  }


  const result = {};

  Object.entries(guild.users || {}).forEach(([userId, user]) => {
    result[userId] = {
      id: userId,
      name: user.nickname || user.name || "알 수 없음",
      avatar: user.avatar,
      seconds: 0,
      online: !!user.currentStart,
      sessions: user.sessions || [],
      totalSeconds: user.totalSeconds || 0,
      freeGoals: user.freeGoals || [],
      studyRecords: user.studyRecords || [],
      memo: user.memo || ""
    };
  });
 
});



  router.get("/weekly", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

    try {
      const { guild } = readContext(req);
      const byDay = new Map();

      for (const [userId, user] of Object.entries(guild.users)) {
        const name = userNameOf(user, userId);
        const avatar = user?.avatar || null;
        const sessions = aggregateSessions(user?.sessions);

        sessions.forEach((s) => {
          const startMs = typeof s.start === "number" ? s.start : new Date(s.start).getTime();
          if (!Number.isFinite(startMs)) return;
          const dayKey = formatDayKeyLocal(startMs);
          const seconds = secondsOf(s);

          if (!byDay.has(dayKey)) {
            byDay.set(dayKey, { dayKey, totalSeconds: 0, users: [] });
          }

          const day = byDay.get(dayKey);
          day.totalSeconds += seconds;

          const existing = day.users.find((u) => u.id === userId);
          if (existing) {
            existing.seconds += seconds;
          } else {
            day.users.push({ id: userId, name, avatar, seconds });
          }
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const last7Keys = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        last7Keys.push(formatDayKeyLocal(d.getTime()));
      }

      const days = last7Keys.map((key) => {
        const day = byDay.get(key);
        if (day) return day;
        return { dayKey: key, totalSeconds: 0, users: [] };
      });

      res.json({ days });
    } catch (err) {
      console.error("/weekly error", err);
      res.status(500).json({ error: "server error" });
    }
  });

  router.get("/dashboard", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

    const { guild, guildId } = readContext(req);
    const users = Object.entries(guild.users).map(([userId, user]) => ({
      id: userId,
      name: userNameOf(user, userId),
      avatar: user?.avatar || null,
      totalSeconds: aggregateTotalSeconds(user),
      goalSec: Number(user?.goalSec || 0),
      online: !!user?.currentStart,
      sessions: Array.isArray(user?.sessions) ? user.sessions : []
    }));

    res.json({ guildId, users });
  });

  router.get("/users-lite", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });
    const { guild, guildId } = readContext(req);
    const users = Object.entries(guild.users).map(([userId, user]) => ({
      id: userId,
      name: userNameOf(user, userId),
      avatar: user?.avatar || null,
      online: !!user?.currentStart
    }));
    res.json({ guildId, users });
  });

  router.get("/days", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

    try {
      const { guild } = readContext(req);
      const byDay = new Map();

      for (const [userId, user] of Object.entries(guild.users)) {
        const name = userNameOf(user, userId);
        const avatar = user?.avatar || null;
        const sessions = aggregateSessions(user?.sessions);

        sessions.forEach((s) => {
          const startMs = typeof s.start === "number" ? s.start : new Date(s.start).getTime();
          if (!Number.isFinite(startMs)) return;
          const dayKey = new Date(startMs).toISOString().slice(0, 10);
          const seconds = secondsOf(s);

          if (!byDay.has(dayKey)) {
            byDay.set(dayKey, { dayKey, totalSeconds: 0, users: [] });
          }

          const day = byDay.get(dayKey);
          day.totalSeconds += seconds;

          const existing = day.users.find((u) => u.id === userId);
          if (existing) {
            existing.seconds += seconds;
          } else {
            day.users.push({ id: userId, name, avatar, seconds });
          }
        });
      }

      const days = Array.from(byDay.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
      res.json({ days });
    } catch (err) {
      console.error("/days error", err);
      res.status(500).json({ error: "server error" });
    }
  });

  router.post("/delete-session", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const userId = String(payload.userId || "");
    const index = Number(payload.index);

    const { data, guild } = readContext(req);
    const user = guild.users[userId];
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    const sessions = Array.isArray(user.sessions) ? user.sessions : [];
    if (!Number.isInteger(index) || index < 0 || index >= sessions.length) {
      return res.status(404).json({ ok: false, error: "Invalid index" });
    }

    sessions.splice(index, 1);
    user.sessions = sessions;
    user.totalSeconds = aggregateTotalSeconds(user);
    saveData(data);

    res.json({ ok: true });
  });

  router.post("/edit-session", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const userId = String(payload.userId || "");
    const index = Number(payload.index);
    const newSeconds = Number(payload.newSeconds);

    const { data, guild } = readContext(req);
    const user = guild.users[userId];
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    const sessions = Array.isArray(user.sessions) ? user.sessions : [];
    if (!Number.isInteger(index) || index < 0 || index >= sessions.length) {
      return res.status(404).json({ ok: false, error: "Invalid index" });
    }

    if (!Number.isFinite(newSeconds) || newSeconds <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid newSeconds" });
    }

    const nowIso = new Date().toISOString();
    sessions[index].seconds = newSeconds;
    sessions[index].editTime = nowIso;
    sessions[index].lastEdit = nowIso;
    user.sessions = sessions;
    user.totalSeconds = aggregateTotalSeconds(user);
    saveData(data);

    res.json({ ok: true });
  });

  router.get("/mypage", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

    const { guild } = readContext(req);
    const users = Object.entries(guild.users).map(([userId, user]) => ({
      id: userId,
      name: userNameOf(user, userId),
      avatar: user?.avatar || null,
      sessions: Array.isArray(user?.sessions) ? user.sessions : [],
      totalSeconds: aggregateTotalSeconds(user),
      goalSec: Number(user?.goalSec || 0),
      memo: user?.memo || "",
      freeGoals: Array.isArray(user?.freeGoals) ? user.freeGoals : [],
      studyRecords: Array.isArray(user?.studyRecords) ? user.studyRecords : []
    }));

    res.json(users);
  });

  router.post("/save-user-data", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const userId = String(payload.userId || "").trim();
    if (!userId) return res.status(400).json({ ok: false, error: "missing userId" });

    const { data, guild } = readContext(req);
    const user = guild.users?.[userId];
    if (!user) return res.status(404).json({ ok: false, error: "user not found" });

    if (payload.freeGoals !== undefined) {
      user.freeGoals = Array.isArray(payload.freeGoals) ? payload.freeGoals : [];
    }

    if (payload.studyRecords !== undefined) {
      user.studyRecords = Array.isArray(payload.studyRecords) ? payload.studyRecords : [];
    }

    if (payload.goalSec !== undefined) {
      const nextGoalSec = Number(payload.goalSec);
      if (Number.isFinite(nextGoalSec) && nextGoalSec >= 0) {
        user.goalSec = Math.floor(nextGoalSec);
      }
    }

    if (payload.monthGoalHours !== undefined) {
      const nextMonthGoalHours = Number(payload.monthGoalHours);
      if (Number.isFinite(nextMonthGoalHours) && nextMonthGoalHours > 0) {
        user.monthGoalHours = Math.floor(nextMonthGoalHours);
      }
    }

    user.totalSeconds = aggregateTotalSeconds(user);
    saveData(data);
    res.json({ ok: true });
  });

  router.get("/manual-data", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

    const { data, guild } = readContext(req);
    const targetUserId = String(req.query?.userId || "").trim();
    const entries = targetUserId ? [[targetUserId, guild.users[targetUserId]]] : Object.entries(guild.users);
    let changed = false;

    const users = entries
      .filter(([_, user]) => !!user)
      .map(([userId, user]) => {
        if (dedupeManualSessionsInPlace(user)) changed = true;
        const manualSessions = (Array.isArray(user?.sessions) ? user.sessions : [])
          .map((s, idx) => ({ s, idx }))
          .filter(({ s }) => s?.manual === true || s?.source === "manual")
          .map(({ s, idx }) => ({
            ...s,
            _index: idx,
            seconds: secondsOf(s),
            _sortMs: manualSortMs(s)
          }))
          .filter((s) => Number(s.seconds) > 0)
          .sort((a, b) => Number(b._sortMs || 0) - Number(a._sortMs || 0))
          .map(({ _sortMs, ...rest }) => rest);

        return {
          id: userId,
          name: userNameOf(user, userId),
          avatar: user?.avatar || null,
          sessions: manualSessions,
          totalSeconds: aggregateTotalSeconds(user)
        };
      });

    if (changed) saveData(data);

    res.json(users);
  });

  router.post("/manual-data", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const userId = String(payload.userId || "");
    const minutes = Number(payload.minutes);

    if (!userId || !Number.isFinite(minutes) || minutes <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid userId/minutes" });
    }

    const { data, guild } = readContext(req);
    if (!guild.users[userId]) {
      guild.users[userId] = {
        nickname: userId,
        avatar: null,
        sessions: [],
        totalSeconds: 0
      };
    }

    const user = guild.users[userId];
    if (!Array.isArray(user.sessions)) user.sessions = [];

    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const seconds = Math.floor(minutes * 60);

    const manualSessions = user.sessions.filter((s) => s && (s.manual === true || s.source === "manual"));
    const duplicated = manualSessions.some((s) => {
      const sec = Number(s?.seconds || 0);
      const st = typeof s?.start === "number" ? s.start : new Date(s?.start).getTime();
      if (!Number.isFinite(st)) return false;
      return sec === seconds && Math.abs(st - nowMs) <= 10000;
    });

    if (duplicated) {
      return res.json({ ok: true, deduped: true });
    }

    user.sessions.unshift({
      start: now,
      end: now,
      seconds,
      manual: true,
      source: "manual",
      editTime: now
    });
    user.totalSeconds = aggregateTotalSeconds(user);

    saveData(data);
    res.json({ ok: true });
  });

  router.post("/memo", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const userId = String(payload.userId || "");
    const memo = String(payload.memo || "");

    const { data, guild } = readContext(req);
    if (!guild.users[userId]) return res.status(404).json({ error: "user not found" });

    guild.users[userId].memo = memo;
    saveData(data);
    res.json({ success: true });
  });

  router.get("/save-memo", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

    const userId = String(req.query.userId || "");
    const memo = String(req.query.memo || "");

    const { data, guild } = readContext(req);
    if (!userId || !guild.users[userId]) {
      return res.status(404).json({ error: "user not found or invalid id" });
    }

    guild.users[userId].memo = memo;
    saveData(data);
    res.json({ success: true });
  });

  router.get("/debug-data", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

    const { guild, guildId } = readContext(req);
    const analysis = Object.entries(guild.users).map(([userId, user]) => ({
      guildId,
      userId,
      hasSessions: Array.isArray(user.sessions),
      sessionCount: Array.isArray(user.sessions) ? user.sessions.length : 0,
      sessions: Array.isArray(user.sessions) ? user.sessions : []
    }));

    res.json(analysis);
  });

router.post("/save-feed", upload.single("image"), async (req, res) => {
  if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

  const bodyUserId = String(req.body.userId || "").trim();
  const nickname = String(req.body.nickname || "");
  const memo = String(req.body.memo || "");
  const { data, guild } = readContext(req);

  let userId = bodyUserId;
  if (!userId || !guild.users?.[userId]) {
    const nicknameNorm = String(nickname || "").trim().toLowerCase();
    const userEntry = Object.entries(guild.users).find(([id, user]) => {
      const candidates = [
        userNameOf(user, id),
        user?.name,
        user?.nickname,
        user?.username
      ]
        .map((v) => String(v || "").trim().toLowerCase())
        .filter(Boolean);
      return candidates.includes(nicknameNorm);
    });
    if (userEntry) userId = userEntry[0];
  }
  if (!userId) userId = String(nickname || "unknown");

  const normalizedMemo = memo.trim();
  let imagePath = null;

  if (req.file) {
    try {
      const uploaded = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "discord-dashboard-feed", resource_type: "image" },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(req.file.buffer);
      });
      imagePath = uploaded?.secure_url || null;
    } catch (err) {
      console.error("cloudinary upload failed, fallback to local:", err?.message || err);
      imagePath = saveImageToLocal(req.file);
      if (!imagePath) {
        return res.status(502).json({ ok: false, error: "image upload failed" });
      }
    }
  }

  if (!normalizedMemo && !imagePath) {
    return res.status(400).json({ error: "empty memo" });
  }

  guild.feed.unshift({
    id: Date.now(),
    userId,
    nickname,
    text: normalizedMemo,
    image: imagePath,
    createdAt: Date.now()
  });

  saveData(data);
  res.json({ ok: true });
});
  router.get("/delete-feed", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: "invalid token" });

    const idNum = Number(req.query.id);
    const nickname = String(req.query.nickname || "");

    const { data, guild } = readContext(req);
    guild.feed = guild.feed.filter((item) => {
      if (item.id !== idNum) return true;
      if (!nickname) return false;
      return item.nickname !== nickname;
    });

    saveData(data);
    res.json({ success: true });
  });

  router.post("/feed-like", (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ ok: false, error: "invalid token" });

    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const feedId = Number(payload.feedId);
    const actor = String(payload.userId || payload.nickname || "anonymous");

    if (!Number.isFinite(feedId)) {
      return res.status(400).json({ ok: false, error: "invalid feedId" });
    }

    const { data, guild } = readContext(req);
    const item = (guild.feed || []).find((f) => Number(f.id) === feedId);
    if (!item) return res.status(404).json({ ok: false, error: "feed not found" });

    const likedBy = Array.isArray(item.likedBy) ? item.likedBy.map(String) : [];
    const idx = likedBy.indexOf(actor);
    let liked = false;

    if (idx >= 0) {
      likedBy.splice(idx, 1);
      liked = false;
    } else {
      likedBy.push(actor);
      liked = true;
    }

    item.likedBy = likedBy;
    item.likes = likedBy.length;

    saveData(data);
    res.json({ ok: true, likes: item.likes, liked });
  });

  return router;
}
