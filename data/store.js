// data/store.js
const fs = require('fs');
const path = require('path');
const { normalizeDataRoot } = require('./guild-data');
const DATA_FILE = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.join(process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname, 'data.json');
const DATA_DIR = path.dirname(DATA_FILE);
const LOCK_FILE = `${DATA_FILE}.lock`;
const LOCK_STALE_MS = 10 * 1000;
const LOCK_WAIT_MS = 3 * 1000;
const LOCK_RETRY_MS = 50;

function sleepMs(ms) {
  const sab = new SharedArrayBuffer(4);
  const arr = new Int32Array(sab);
  Atomics.wait(arr, 0, 0, ms);
}

function isTransientFsError(err) {
  const code = String(err?.code || '');
  return code === 'UNKNOWN' || code === 'EBUSY' || code === 'EPERM' || code === 'EACCES';
}

function parseLockInfo() {
  try {
    const [pidText, createdText] = fs.readFileSync(LOCK_FILE, 'utf8').trim().split(':');
    return {
      pid: Number.parseInt(pidText, 10),
      createdAt: Number.parseInt(createdText, 10)
    };
  } catch (_) {
    return { pid: NaN, createdAt: NaN };
  }
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return String(err?.code || '') === 'EPERM';
  }
}

function removeStaleLock() {
  try {
    const stat = fs.statSync(LOCK_FILE);
    const { pid, createdAt } = parseLockInfo();
    const lockAge = Date.now() - Math.max(
      Number.isFinite(createdAt) ? createdAt : 0,
      Number.isFinite(stat.mtimeMs) ? stat.mtimeMs : 0
    );

    if (!isPidAlive(pid) || lockAge > LOCK_STALE_MS) {
      fs.unlinkSync(LOCK_FILE);
      return true;
    }
  } catch (_) {}

  return false;
}

function tryAcquireLock() {
  const token = `${process.pid}:${Date.now()}`;

  try {
    const fd = fs.openSync(LOCK_FILE, 'wx');
    fs.writeFileSync(fd, token, 'utf8');
    fs.closeSync(fd);
    return token;
  } catch (err) {
    if (String(err?.code) !== 'EEXIST') return false;
    if (removeStaleLock()) return tryAcquireLock();
    return false;
  }
}

function acquireLockWithRetry() {
  const startedAt = Date.now();

  do {
    const token = tryAcquireLock();
    if (token) return token;
    sleepMs(LOCK_RETRY_MS);
  } while (Date.now() - startedAt < LOCK_WAIT_MS);

  return false;
}

function releaseLock(token) {
  try {
    if (!fs.existsSync(LOCK_FILE)) return;
    if (token && fs.readFileSync(LOCK_FILE, 'utf8').trim() !== token) return;
    fs.unlinkSync(LOCK_FILE);
  } catch (_) {}
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return normalizeDataRoot({});
    }

    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content);
    return normalizeDataRoot(parsed);
  } catch (e) {
    console.error('[loadData]', e);
    return normalizeDataRoot({});
  }
}

function saveData(data) {
  const payload = JSON.stringify(normalizeDataRoot(data), null, 2);
  const maxRetries = 2;

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}

  const lockToken = acquireLockWithRetry();
  if (!lockToken) {
    console.error('[saveData] lock busy after retry (skip):', LOCK_FILE);
    return;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const tempFile = `${DATA_FILE}.tmp.${process.pid}`;
      fs.writeFileSync(tempFile, payload, 'utf8');
      fs.renameSync(tempFile, DATA_FILE);
      releaseLock(lockToken);
      return;
    } catch (err) {
      const lastTry = attempt === maxRetries;
      if (!isTransientFsError(err) || lastTry) {
        console.error('[saveData] write failed:', err);
        releaseLock(lockToken);
        return;
      }

      // 짧은 재시도만 수행해 이벤트 루프 장시간 블로킹을 피합니다.
      sleepMs(10);
    }
  }

  releaseLock(lockToken);
}

module.exports = { loadData, saveData, DATA_FILE };
