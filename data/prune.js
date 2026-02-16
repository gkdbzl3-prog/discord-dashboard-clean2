
const { loadData, saveData } = require('./store');



/**
 * @param {number} keepDays
 * */

function pruneOldSessions(keepDays) {
  const data = loadData();   // ✅ 맨 위에서 한 번만

  const nowMs = Date.now();
  const cutoff = nowMs - keepDays * 24 * 60 * 60 * 1000;

  
  let removed = 0;

  for (const [uid, user] of Object.entries(data)) {
    if (uid === '_meta') continue;
    if (!user || !Array.isArray(user.sessions)) {
  
    

    user.sessions = user.sessions.filter(s => {
      const end = Date.parse(s.end);
      return Number.isFinite(end) && end >= cutoff;
    });

    

    removed += before - user.sessions.length;
  }

  if (removed > 0) {
    saveData(data);
    console.log(`🧺 세션 정리 완료: ${removedCount}개 삭제 (최근 ${KEEP_SESSION_DAYS}일만 유지)`);
  }
}}


module.exports = { pruneOldSessions, loadData };
