// session-compaction.js
//
// 30초마다 도는 자동 분할 저장이 매번 새 세션 레코드를 unshift 하는 바람에
// 한 사람의 sessions 가 72,502개(5.5MB)까지 불어났고, data.json 이 30MB가 되어
// 매 tick 마다 30MB를 parse/stringify 하다 shared-cpu-1x 의 CPU를 다 써버렸다.
// (2026-09-04, 웹서버가 accept 조차 못 하는 상태로 관측됨)
//
// 이어지는 auto_split 조각은 하나의 블록으로 합친다. 합쳐도 초 합계는 같고,
// aggregateTotalByEventAndManual 은 auto_split 을 애초에 세지 않으므로
// 총 공부시간에는 영향이 없다.
//
// 다만 today.js 는 세션을 "시작 시각이 속한 날"로 집계하므로, 자정을 넘겨
// 합치면 자정 이후 몫이 전날로 딸려간다. 그래서 KST 하루 경계는 넘기지 않는다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const AUTO_SPLIT = 'auto_split';

function kstDayIndex(ms) {
  return Math.floor((ms + KST_OFFSET_MS) / DAY_MS);
}

function isAutoSplit(session) {
  return !!session && session.source === AUTO_SPLIT;
}

// 끝이 정확히 자정이면 아직 전날에 속한 것으로 본다.
function withinOneKstDay(startMs, endMs) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return false;
  return kstDayIndex(startMs) === kstDayIndex(endMs - 1);
}

function secondsBetween(startMs, endMs) {
  return Math.floor((endMs - startMs) / 1000);
}

// 레코드에 적힌 초. 없으면 타임스탬프에서 뽑는다(bot.js 의 secondsOfSession 과 같은 규칙).
function secondsOf(session) {
  const direct = Number(session?.seconds || 0);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);

  const start = session?.start;
  const end = session?.end;
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return secondsBetween(start, end);
  }
  return 0;
}

// 자동 분할 tick 한 번. 직전 블록에 이어지면 늘리고, 아니면 새로 만든다.
// sessions 는 최신이 앞(unshift)인 배열이다.
function appendAutoSplitSession(user, now) {
  const sessions = (user.sessions ??= []);
  const start = user.currentStart;
  const head = sessions[0];

  if (isAutoSplit(head) && head.end === start && withinOneKstDay(head.start, now)) {
    head.end = now;
    head.seconds = secondsBetween(head.start, now);
    return { merged: true, session: head };
  }

  const session = { start, end: now, seconds: secondsBetween(start, now), source: AUTO_SPLIT };
  sessions.unshift(session);
  return { merged: false, session };
}

// 이미 쌓여버린 배열을 한 번에 압축한다(마이그레이션용).
// auto_split 이 아닌 레코드(camera_event, manual, legacy)는 그대로 둔다.
function compactAutoSplitSessions(sessions) {
  if (!Array.isArray(sessions)) return [];

  const out = [];

  for (const session of sessions) {
    const head = out[out.length - 1]; // 바로 앞에 넣은, 더 최신인 블록

    if (isAutoSplit(head)
      && isAutoSplit(session)
      && head.start === session.end
      && withinOneKstDay(session.start, head.end)) {
      // 여기서만은 타임스탬프로 다시 계산하지 않고 초를 더한다.
      // 조각마다 Math.floor 로 1초 미만이 잘려나가 있어서, 다시 계산하면 하루치가
      // 수 분씩 늘어난다. 과거 기록은 있는 그대로 두는 쪽이 맞다.
      // (앞으로 쌓이는 것은 appendAutoSplitSession 이 블록 시작 기준으로 계산해
      //  애초에 잘림이 생기지 않는다.)
      head.start = session.start;
      head.seconds = secondsOf(head) + secondsOf(session);
      continue;
    }

    out.push({ ...session });
  }

  return out;
}

// 저장소 전체를 한 번 훑어 압축한다. 부팅할 때 불러 두면
//  1) 밖에서 스크립트로 고쳐 넣다 30초 tick 과 경합해 덮어써지는 일이 없고,
//  2) 어떤 이유로 다시 불어나도 다음 재시작에 알아서 정리된다.
// 이미 압축된 데이터에는 아무것도 하지 않고 0 을 돌려준다.
function compactAllSessions(dataRoot) {
  let removed = 0;

  for (const guild of Object.values(dataRoot?.guilds || {})) {
    for (const user of Object.values(guild?.users || {})) {
      const sessions = Array.isArray(user?.sessions) ? user.sessions : null;
      if (!sessions || sessions.length === 0) continue;

      const compacted = compactAutoSplitSessions(sessions);
      if (compacted.length === sessions.length) continue;

      removed += sessions.length - compacted.length;
      user.sessions = compacted;
    }
  }

  return removed;
}

module.exports = {
  appendAutoSplitSession,
  compactAllSessions,
  secondsOf,
  compactAutoSplitSessions,
  withinOneKstDay,
  kstDayIndex
};
