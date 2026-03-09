const express = require('express');
const { loadData, saveData } = require('../data/store');

module.exports = function createAdminRouter(client) {
  const router = express.Router();

  function readData() {
    const data = loadData() || {};
    if (!data.users || typeof data.users !== 'object') data.users = {};
    if (!Array.isArray(data.feed)) data.feed = [];
    return data;
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
    const startMs = typeof s?.start === 'number' ? s.start : new Date(s?.start).getTime();
    const endMs = typeof s?.end === 'number' ? s.end : new Date(s?.end).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      return Math.floor((endMs - startMs) / 1000);
    }
    return 0;
  }

  function aggregateSessions(sessions) {
    const list = Array.isArray(sessions) ? sessions : [];
    const hasTagged = list.some((s) => typeof s?.source === 'string');
    if (!hasTagged) return list;
    return list.filter((s) => !s?.source || s?.source === 'camera_event' || s?.source === 'manual' || s?.manual === true);
  }

  function aggregateTotalSeconds(user) {
    return aggregateSessions(user?.sessions).reduce((sum, s) => sum + secondsOf(s), 0);
  }

  function normalizeFeed(feed = []) {
    const list = Array.isArray(feed) ? feed : [];
    const milestoneSeen = new Set();
    const out = [];

    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const text = String(raw.text ?? '').trim();
      if (!text || /^undefined$/i.test(text)) continue;

      const createdAt = Number(raw.createdAt || Date.now());
      const userId = String(raw.userId || '');
      const isFiveHour = /오늘\s*5시간\s*달성/.test(text);

      if (isFiveHour) {
        const d = new Date(createdAt);
        const dayKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        const key = `${userId}|${dayKey}|${text}`;
        if (milestoneSeen.has(key)) continue;
        milestoneSeen.add(key);
      }

      out.push({
        ...raw,
        text,
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
      .filter(({ s }) => s?.manual === true || s?.source === 'manual')
      .map(({ s, idx }) => {
        const st = typeof s?.start === 'number' ? s.start : new Date(s?.start).getTime();
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

  router.get('/today', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    try {
      const data = readData();
      const users = {};

      for (const [userId, user] of Object.entries(data.users)) {
        users[userId] = {
          id: userId,
          name: userNameOf(user, userId),
          avatar: user?.avatar || null,
          online: !!user?.currentStart,
          currentStart: user?.currentStart || null,
          sessions: Array.isArray(user?.sessions) ? user.sessions : [],
          seconds: Number(user?.seconds || 0),
          totalSeconds: aggregateTotalSeconds(user),
          goalSec: Number(user?.goalSec || 0),
          memo: user?.memo || '',
          freeGoals: Array.isArray(user?.freeGoals) ? user.freeGoals : [],
          studyRecords: Array.isArray(user?.studyRecords) ? user.studyRecords : []
        };
      }

      const normalizedFeed = normalizeFeed(data.feed);
      if (normalizedFeed.length !== (Array.isArray(data.feed) ? data.feed.length : 0)) {
        data.feed = normalizedFeed;
        saveData(data);
      }
      res.json({ users, feed: normalizedFeed });
    } catch (err) {
      console.error('/today error', err);
      res.status(500).json({ error: 'server error' });
    }
  });

  router.get('/weekly', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    try {
      const data = readData();
      const byDay = new Map();

      for (const [userId, user] of Object.entries(data.users)) {
        const name = userNameOf(user, userId);
        const avatar = user?.avatar || null;
        const sessions = aggregateSessions(user?.sessions);

        sessions.forEach((s) => {
          const startMs = typeof s.start === 'number' ? s.start : new Date(s.start).getTime();
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
      console.error('/weekly error', err);
      res.status(500).json({ error: 'server error' });
    }
  });

  router.get('/dashboard', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    const data = readData();
    const users = Object.entries(data.users).map(([userId, user]) => ({
      id: userId,
      name: userNameOf(user, userId),
      avatar: user?.avatar || null,
      totalSeconds: aggregateTotalSeconds(user),
      goalSec: Number(user?.goalSec || 0),
      online: !!user?.currentStart,
      sessions: Array.isArray(user?.sessions) ? user.sessions : []
    }));

    res.json({ users });
  });

  router.get('/users-lite', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });
    const data = readData();
    const users = Object.entries(data.users).map(([userId, user]) => ({
      id: userId,
      name: userNameOf(user, userId),
      avatar: user?.avatar || null,
      online: !!user?.currentStart
    }));
    res.json({ users });
  });

  router.get('/days', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    try {
      const data = readData();
      const byDay = new Map();

      for (const [userId, user] of Object.entries(data.users)) {
        const name = userNameOf(user, userId);
        const avatar = user?.avatar || null;
        const sessions = aggregateSessions(user?.sessions);

        sessions.forEach((s) => {
          const startMs = typeof s.start === 'number' ? s.start : new Date(s.start).getTime();
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
      console.error('/days error', err);
      res.status(500).json({ error: 'server error' });
    }
  });

  router.post('/delete-session', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const userId = String(payload.userId || '');
    const index = Number(payload.index);

    const data = readData();
    const user = data.users[userId];
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    const sessions = Array.isArray(user.sessions) ? user.sessions : [];
    if (!Number.isInteger(index) || index < 0 || index >= sessions.length) {
      return res.status(404).json({ ok: false, error: 'Invalid index' });
    }

    sessions.splice(index, 1);
    user.sessions = sessions;
    user.totalSeconds = aggregateTotalSeconds(user);
    saveData(data);

    res.json({ ok: true });
  });

  router.post('/edit-session', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const userId = String(payload.userId || '');
    const index = Number(payload.index);
    const newSeconds = Number(payload.newSeconds);

    const data = readData();
    const user = data.users[userId];
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    const sessions = Array.isArray(user.sessions) ? user.sessions : [];
    if (!Number.isInteger(index) || index < 0 || index >= sessions.length) {
      return res.status(404).json({ ok: false, error: 'Invalid index' });
    }

    if (!Number.isFinite(newSeconds) || newSeconds <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid newSeconds' });
    }

    sessions[index].seconds = newSeconds;
    sessions[index].lastEdit = payload.editTime || new Date().toISOString();
    user.sessions = sessions;
    user.totalSeconds = aggregateTotalSeconds(user);
    saveData(data);

    res.json({ ok: true });
  });

  router.get('/mypage', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    const data = readData();
    const users = Object.entries(data.users).map(([userId, user]) => ({
      id: userId,
      name: userNameOf(user, userId),
      avatar: user?.avatar || null,
      sessions: Array.isArray(user?.sessions) ? user.sessions : [],
      totalSeconds: aggregateTotalSeconds(user),
      goalSec: Number(user?.goalSec || 0),
      memo: user?.memo || '',
      freeGoals: Array.isArray(user?.freeGoals) ? user.freeGoals : [],
      studyRecords: Array.isArray(user?.studyRecords) ? user.studyRecords : []
    }));

    res.json(users);
  });

  router.get('/manual-data', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    const data = readData();
    const targetUserId = String(req.query?.userId || '').trim();
    const entries = targetUserId ? [[targetUserId, data.users[targetUserId]]] : Object.entries(data.users);
    let changed = false;

    const users = entries
      .filter(([_, user]) => !!user)
      .map(([userId, user]) => {
      if (dedupeManualSessionsInPlace(user)) changed = true;
      return {
      id: userId,
      name: userNameOf(user, userId),
      avatar: user?.avatar || null,
      sessions: (Array.isArray(user?.sessions) ? user.sessions : [])
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => s?.manual === true || s?.source === 'manual')
        .map(({ s, idx }) => ({ ...s, _index: idx, seconds: secondsOf(s) }))
        .filter((s) => Number(s.seconds) > 0),
      totalSeconds: aggregateTotalSeconds(user)
    };
    });

    if (changed) saveData(data);

    res.json(users);
  });

  router.post('/manual-data', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const userId = String(payload.userId || '');
    const minutes = Number(payload.minutes);

    if (!userId || !Number.isFinite(minutes) || minutes <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid userId/minutes' });
    }

    const data = readData();
    if (!data.users[userId]) {
      data.users[userId] = {
        nickname: userId,
        avatar: null,
        sessions: [],
        totalSeconds: 0
      };
    }

    const user = data.users[userId];
    if (!Array.isArray(user.sessions)) user.sessions = [];

    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const seconds = Math.floor(minutes * 60);

    const manualSessions = user.sessions.filter((s) => s && (s.manual === true || s.source === 'manual'));
    const duplicated = manualSessions.some((s) => {
      const sec = Number(s?.seconds || 0);
      const st = typeof s?.start === 'number' ? s.start : new Date(s?.start).getTime();
      if (!Number.isFinite(st)) return false;
      return sec === seconds && Math.abs(st - nowMs) <= 10000;
    });

    if (duplicated) {
      return res.json({ ok: true, deduped: true });
    }

    user.sessions.push({ start: now, end: now, seconds, manual: true, source: 'manual' });
    user.totalSeconds = aggregateTotalSeconds(user);

    saveData(data);
    res.json({ ok: true });
  });

  router.post('/memo', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const userId = String(payload.userId || '');
    const memo = String(payload.memo || '');

    const data = readData();
    if (!data.users[userId]) return res.status(404).json({ error: 'user not found' });

    data.users[userId].memo = memo;
    saveData(data);
    res.json({ success: true });
  });

  router.get('/save-memo', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    const userId = String(req.query.userId || '');
    const memo = String(req.query.memo || '');

    const data = readData();
    if (!userId || !data.users[userId]) {
      return res.status(404).json({ error: 'user not found or invalid id' });
    }

    data.users[userId].memo = memo;
    saveData(data);
    res.json({ success: true });
  });

  router.get('/debug-data', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    const data = readData();
    const analysis = Object.entries(data.users).map(([userId, user]) => ({
      userId,
      hasSessions: Array.isArray(user.sessions),
      sessionCount: Array.isArray(user.sessions) ? user.sessions.length : 0,
      sessions: Array.isArray(user.sessions) ? user.sessions : []
    }));

    res.json(analysis);
  });

  router.get('/save-feed', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    const nickname = String(req.query.nickname || '');
    const memo = String(req.query.memo || '');
    const data = readData();

    const userEntry = Object.entries(data.users).find(([id, user]) => {
      const name = userNameOf(user, id);
      return name === nickname || user?.name === nickname || user?.nickname === nickname;
    });

    if (!userEntry) return res.status(400).json({ error: 'user not found' });

    const userId = userEntry[0];
    const normalizedMemo = memo.trim();
    if (!normalizedMemo || /^undefined$/i.test(normalizedMemo)) {
      return res.status(400).json({ error: 'empty memo' });
    }

    const now = Date.now();
    const isFiveHour = /오늘\s*5시간\s*달성/.test(normalizedMemo);
    if (isFiveHour) {
      const already = (Array.isArray(data.feed) ? data.feed : []).some((f) => {
        const sameUser = String(f?.userId || '') === String(userId);
        const sameText = String(f?.text || '') === normalizedMemo;
        if (!sameUser || !sameText) return false;
        const t = Number(f?.createdAt || 0);
        if (!Number.isFinite(t) || t <= 0) return false;
        return now - t < 24 * 60 * 60 * 1000;
      });
      if (already) {
        return res.json({ ok: true, deduped: true });
      }
    }

    data.feed.unshift({
      id: Date.now(),
      userId,
      nickname,
      text: normalizedMemo,
      createdAt: now
    });

    saveData(data);
    res.json({ ok: true });
  });

  router.get('/delete-feed', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ error: 'invalid token' });

    const idNum = Number(req.query.id);
    const nickname = String(req.query.nickname || '');

    const data = readData();
    data.feed = data.feed.filter((item) => {
      if (item.id !== idNum) return true;
      if (!nickname) return false;
      return item.nickname !== nickname;
    });

    saveData(data);
    res.json({ success: true });
  });

  router.post('/feed-like', (req, res) => {
    if (isTokenInvalid(req)) return res.status(403).json({ ok: false, error: 'invalid token' });

    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const feedId = Number(payload.feedId);
    const actor = String(payload.userId || payload.nickname || 'anonymous');

    if (!Number.isFinite(feedId)) {
      return res.status(400).json({ ok: false, error: 'invalid feedId' });
    }

    const data = readData();
    const item = (data.feed || []).find((f) => Number(f.id) === feedId);
    if (!item) return res.status(404).json({ ok: false, error: 'feed not found' });

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
};
