/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const apply = args.includes('--apply');

const DATA_FILE = process.env.DATA_FILE || '/data/data.json';
const BACKUPS_DIR = process.env.BACKUPS_DIR || '/app/backups';

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

function secondsOf(session) {
  const direct = Number(session?.seconds || 0);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  const st = toMs(session?.start);
  const en = toMs(session?.end);
  if (Number.isFinite(st) && Number.isFinite(en) && en > st) {
    return Math.floor((en - st) / 1000);
  }
  return 0;
}

function sessionKey(session) {
  const st = toMs(session?.start);
  const en = toMs(session?.end);
  const sec = secondsOf(session);
  if (!Number.isFinite(st) || !Number.isFinite(en) || en <= st || sec <= 0) return '';
  return `${st}|${en}|${sec}`;
}

function normalizeUsers(root) {
  if (!root || typeof root !== 'object') return {};
  if (root.users && typeof root.users === 'object') return root.users;
  return root;
}

function ensureUser(dataUsers, userId, backupUser) {
  if (!dataUsers[userId] || typeof dataUsers[userId] !== 'object') {
    dataUsers[userId] = {
      id: userId,
      nickname: backupUser?.nickname || backupUser?.name || backupUser?.username || userId,
      avatar: backupUser?.avatar || null,
      sessions: [],
      totalSeconds: 0,
      currentStart: null,
      eventStart: null
    };
  }
  if (!Array.isArray(dataUsers[userId].sessions)) dataUsers[userId].sessions = [];
  if (!dataUsers[userId].nickname && backupUser?.nickname) dataUsers[userId].nickname = backupUser.nickname;
  if (!dataUsers[userId].avatar && backupUser?.avatar) dataUsers[userId].avatar = backupUser.avatar;
  return dataUsers[userId];
}

function main() {
  const data = loadJson(DATA_FILE);
  if (!data || typeof data !== 'object') {
    console.error(`[restore] failed to parse DATA_FILE: ${DATA_FILE}`);
    process.exit(1);
  }
  if (!data.users || typeof data.users !== 'object') data.users = {};

  const files = fs.existsSync(BACKUPS_DIR)
    ? fs.readdirSync(BACKUPS_DIR).filter((name) => name.endsWith('.json'))
    : [];

  let scannedFiles = 0;
  let importedSessions = 0;
  let touchedUsers = 0;
  const touchedSet = new Set();

  for (const name of files) {
    const full = path.join(BACKUPS_DIR, name);
    const backup = loadJson(full);
    if (!backup) continue;
    scannedFiles += 1;

    const backupUsers = normalizeUsers(backup);
    for (const [userId, backupUser] of Object.entries(backupUsers)) {
      if (!backupUser || typeof backupUser !== 'object') continue;
      const sessions = Array.isArray(backupUser.sessions) ? backupUser.sessions : [];
      if (sessions.length === 0) continue;

      const user = ensureUser(data.users, userId, backupUser);
      const existingKeys = new Set(
        (Array.isArray(user.sessions) ? user.sessions : [])
          .map((s) => sessionKey(s))
          .filter(Boolean)
      );

      for (const s of sessions) {
        const key = sessionKey(s);
        if (!key || existingKeys.has(key)) continue;

        const st = toMs(s.start);
        const en = toMs(s.end);
        const sec = secondsOf(s);

        user.sessions.push({
          start: st,
          end: en,
          seconds: sec,
          source: s?.source || 'backup_import'
        });
        existingKeys.add(key);
        importedSessions += 1;
        touchedSet.add(userId);
      }
    }
  }

  touchedUsers = touchedSet.size;

  const summary = {
    apply,
    dataFile: DATA_FILE,
    backupsDir: BACKUPS_DIR,
    scannedFiles,
    touchedUsers,
    importedSessions
  };

  if (apply) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('[restore] applied');
  } else {
    console.log('[restore] dry-run');
  }
  console.log(JSON.stringify(summary, null, 2));
}

main();
