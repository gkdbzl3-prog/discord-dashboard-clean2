// data/store.js
const fs = require('fs');
const path = require('path');
const DATA_FILE = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.join(process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname, 'data.json');
const DATA_DIR = path.dirname(DATA_FILE);
const LOCK_FILE = `${DATA_FILE}.lock`;

function sleepMs(ms) {
  const sab = new SharedArrayBuffer(4);
  const arr = new Int32Array(sab);
  Atomics.wait(arr, 0, 0, ms);
}

function isTransientFsError(err) {
  const code = String(err?.code || '');
  return code === 'UNKNOWN' || code === 'EBUSY' || code === 'EPERM' || code === 'EACCES';
}

function tryAcquireLock(maxWaitMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx');
      fs.writeFileSync(fd, `${process.pid}:${Date.now()}`, 'utf8');
      fs.closeSync(fd);
      return true;
    } catch (err) {
      if (String(err?.code) !== 'EEXIST') {
        sleepMs(20);
        continue;
      }

      // stale lock cleanup
      try {
        const stat = fs.statSync(LOCK_FILE);
        if (Date.now() - stat.mtimeMs > 15000) {
          fs.unlinkSync(LOCK_FILE);
          continue;
        }
      } catch (_) {}

      sleepMs(20);
    }
  }
  return false;
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch (_) {}
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { users: {}, feed: [] };
    }

    const content = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('[loadData]', e);
    return { users: {}, feed: [] };
  }
}

function saveData(data) {
  const payload = JSON.stringify(data, null, 2);
  const maxRetries = 6;

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}

  if (!tryAcquireLock()) {
    console.error('[saveData] lock timeout:', LOCK_FILE);
    return;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const tempFile = `${DATA_FILE}.tmp.${process.pid}`;
      fs.writeFileSync(tempFile, payload, 'utf8');
      fs.renameSync(tempFile, DATA_FILE);
      releaseLock();
      return;
    } catch (err) {
      const lastTry = attempt === maxRetries;
      if (!isTransientFsError(err) || lastTry) {
        console.error('[saveData] write failed:', err);
        releaseLock();
        return;
      }

      // Windows file lock(AV/indexer/other process) 대응: 짧게 대기 후 재시도
      sleepMs(40 * (attempt + 1));
    }
  }

  releaseLock();
}

module.exports = { loadData, saveData, DATA_FILE };
