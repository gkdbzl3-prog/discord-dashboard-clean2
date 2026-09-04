#!/usr/bin/env node
// scripts/compact-sessions.js
//
// 이어지는 auto_split 세션 조각을 하나의 블록으로 합쳐 data.json 을 줄인다.
// 2026-09-04 기준 한 사람의 sessions 가 72,502개, 파일이 30MB까지 커져서
// 30초마다 도는 저장 tick 이 CPU를 다 써버렸고 웹서버가 응답을 못 했다.
//
//   확인만:  node scripts/compact-sessions.js
//   실제로:  node scripts/compact-sessions.js --apply
//
// --apply 는 쓰기 전에 원본을 .bak.<타임스탬프> 로 남기고, 아래 세 가지가
// 하나라도 어긋나면 아무것도 쓰지 않고 멈춘다.
//   1. 유저별 초 합계가 같은가
//   2. KST 날짜별 초 합계가 같은가
//   3. auto_split 이 아닌 레코드가 순서까지 그대로인가

const fs = require('fs');
const path = require('path');
const { compactAutoSplitSessions, secondsOf, kstDayIndex } = require('../session-compaction');

const DATA_FILE = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.join(__dirname, '..', 'data', 'data.json');

const APPLY = process.argv.includes('--apply');

function dayBuckets(sessions) {
  const buckets = new Map();
  for (const s of sessions) {
    if (!Number.isFinite(s?.start)) continue;
    const key = kstDayIndex(s.start);
    buckets.set(key, (buckets.get(key) || 0) + secondsOf(s));
  }
  return buckets;
}

function sameBuckets(a, b) {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (b.get(key) !== value) return false;
  }
  return true;
}

function otherSources(sessions) {
  return JSON.stringify(sessions.filter((s) => s?.source !== 'auto_split'));
}

function verify(before, after, label) {
  const problems = [];

  const sumBefore = before.reduce((n, s) => n + secondsOf(s), 0);
  const sumAfter = after.reduce((n, s) => n + secondsOf(s), 0);
  if (sumBefore !== sumAfter) {
    problems.push(`${label}: 초 합계 ${sumBefore} → ${sumAfter}`);
  }

  if (!sameBuckets(dayBuckets(before), dayBuckets(after))) {
    problems.push(`${label}: KST 날짜별 합계가 달라짐`);
  }

  if (otherSources(before) !== otherSources(after)) {
    problems.push(`${label}: auto_split 이 아닌 레코드가 변형됨`);
  }

  return problems;
}

function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`파일이 없습니다: ${DATA_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const root = JSON.parse(raw);

  if (!root.guilds || Object.keys(root.guilds).length === 0) {
    // 2026-03 이전 백업은 users 가 최상위에 있는 옛 형식이다. 운영 파일은 guilds
    // 형식이므로, 여기 걸리면 엉뚱한 파일을 가리키고 있다는 뜻이다.
    console.error('guilds 가 없습니다. 옛 형식이거나 잘못된 파일입니다:', DATA_FILE);
    process.exit(1);
  }

  const problems = [];
  let usersTouched = 0;
  let before = 0;
  let after = 0;

  for (const [guildId, guild] of Object.entries(root.guilds || {})) {
    for (const [userId, user] of Object.entries(guild?.users || {})) {
      const sessions = Array.isArray(user?.sessions) ? user.sessions : null;
      if (!sessions || sessions.length === 0) continue;

      const compacted = compactAutoSplitSessions(sessions);
      if (compacted.length === sessions.length) continue;

      problems.push(...verify(sessions, compacted, `${guildId}/${userId}`));

      console.log(
        `  ${guildId}/${userId}  ${sessions.length} → ${compacted.length}`
        + ` (${(100 - (compacted.length / sessions.length) * 100).toFixed(1)}% 감소)`
      );

      before += sessions.length;
      after += compacted.length;
      usersTouched += 1;
      user.sessions = compacted;
    }
  }

  console.log(`\n대상 ${usersTouched}명, 세션 ${before} → ${after}`);

  if (problems.length > 0) {
    console.error('\n검증 실패 — 아무것도 쓰지 않았습니다:');
    problems.forEach((p) => console.error(`  ${p}`));
    process.exit(1);
  }
  console.log('검증 통과 (초 합계 · KST 날짜별 합계 · 다른 source 레코드 모두 동일)');

  const payload = JSON.stringify(root);
  console.log(
    `파일 크기 ${(raw.length / 1048576).toFixed(1)}MB → ${(payload.length / 1048576).toFixed(1)}MB`
  );

  if (!APPLY) {
    console.log('\n확인만 했습니다. 실제로 쓰려면 --apply 를 붙이세요.');
    return;
  }

  const backup = `${DATA_FILE}.bak.${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(DATA_FILE, backup);
  console.log(`\n원본 백업: ${backup}`);

  const temp = `${DATA_FILE}.compact.tmp`;
  fs.writeFileSync(temp, payload, 'utf8');
  fs.renameSync(temp, DATA_FILE);
  console.log('완료.');
}

main();
