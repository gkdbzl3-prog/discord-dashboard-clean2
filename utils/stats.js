// utils/stats.js
const overlapSeconds = require('./utils/time');
const express = require('express');
const path = require('path');
const { loadData } = require('./data/store');
const nowMs = require('./utils/time')
const kstDateKeyFromMs = require('./time')
const dayKey = kstDateKeyFromMs(nowMs);
const data = loadData();

function countTodayCheckins(data, nowMs) {
    let count = 0;
    for (const [uid, u] of Object.entries(data)) {
      if (uid === '_meta') continue;
      if (!u || !user.attendance || !user.attendance.days) continue;
      if (u.attendance.days[dayKey]) count++;
    }
    return count;
  }



  function computefinalUsersecondsInRange(userData, rangeStartMs, rangeEndMs) {
    let sec = 0;

    for (const sess of (userData.sessions || [])) {
      const s = Date.parse(sess.start);
      const e = Date.parse(sess.end);
      if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
    }

    if (userData.currentStart) {
      sec += overlapSeconds(userData.currentStart, Date.now(), rangeStartMs, rangeEndMs);
    }
    return sec;
}
function getTopfinalUsersBySeconds(data, rangeStartMs, rangeEndMs, limit = 10) {
    const rows = [];
    for (const [uid, user] of Object.entries(data)) {
      if (uid === '_meta') continue;
      if (!user) continue;

      const sec = computefinalUsersecondsInRange(u, rangeStartMs, rangeEndMs);
      if (sec > 0) rows.push({ userId: uid,name:
  user.nickname ||
  user.userTag ||
  user.username ||
  id.replace("ryurui_", "") ||
  "Unknown", sec });
    }
    rows.sort((a, b) => b.sec - a.sec);
    return rows.slice(0, limit);
  }
    function calcSummary(data) {
  let finalUsers = 0;
  let sessions = 0;

  for (const u of Object.values(data)) {
    finalUsers++;
    sessions += user.sessions?.length || 0;
  }

  return { finalUsers, sessions };
}
module.exports = { countTodayCheckins, getTopfinalUsersBySeconds, calcSummary, overlapseconds };
