const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// 자리를 비우고부터 실제로 나서기까지 준비에 쓰는 시간. 날마다 재는 대신
// 한 시간으로 고정한다(날님이 정한 값). 여기만 바꾸면 전부 따라온다.
const PREP_MINUTES = 60;

function parseDepartureTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || '').trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

// `40분`, `1시간`, `1시간20분` 처럼 단위가 붙은 것만 소요시간으로 본다.
// 맨 숫자를 받으면 사유에 들어간 숫자까지 먹어버린다.
function parseDurationMinutes(value) {
  const text = String(value || '').trim();
  const match = /^(?:(\d{1,2})시간)?(?:(\d{1,3})분)?$/.exec(text);
  if (!match || (match[1] === undefined && match[2] === undefined)) return null;

  const minutes = Number(match[1] || 0) * 60 + Number(match[2] || 0);
  if (minutes <= 0 || minutes > 24 * 60) return null;
  return minutes;
}

function kstClock(at) {
  const kst = new Date(Number(at) + KST_OFFSET_MS);
  const hour = String(kst.getUTCHours()).padStart(2, '0');
  const minute = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function nextKstDepartureAt(value, now = Date.now()) {
  const parsed = parseDepartureTime(value);
  if (!parsed) return null;

  const kstNow = new Date(Number(now) + KST_OFFSET_MS);
  let targetAt = Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate(),
    parsed.hour - 9,
    parsed.minute,
    0,
    0,
  );

  if (targetAt <= Number(now)) targetAt += DAY_MS;
  return targetAt;
}

function minutesUntilDeparture(targetAt, now = Date.now()) {
  const remainingMs = Math.max(0, Number(targetAt) - Number(now));
  return Math.ceil(remainingMs / 60_000);
}

// 적는 건 시각 하나와 약속 장소까지 걸리는 시간 둘뿐이다. 거기서 두 번 뺀다.
//   출발            = 적은 시각 − 이동시간
//   자리 비움(준비) = 출발 − 준비시간
// 카운트다운이 세는 건 마지막 것, 자리를 비워야 하는 시각이다.
function awayPlan({ departureTime, travelMinutes = 0, prepMinutes = PREP_MINUTES, now = Date.now() }) {
  const arriveAt = nextKstDepartureAt(departureTime, now);
  if (!Number.isFinite(Number(arriveAt))) return null;

  const travel = Math.max(0, Math.floor(Number(travelMinutes) || 0));
  const prep = Math.max(0, Math.floor(Number(prepMinutes) || 0));
  const departAt = arriveAt - travel * 60_000;
  return {
    arriveAt,
    departAt,
    awayAt: departAt - prep * 60_000,
    travelMinutes: travel,
    prepMinutes: prep,
  };
}

function createAwayCountdown({ message, departureTime, travelMinutes = 0, userId, now = Date.now() }) {
  const plan = awayPlan({ departureTime, travelMinutes, now });
  return {
    message: String(message || ''),
    departureTime: String(departureTime || ''),
    travelMinutes: plan ? plan.travelMinutes : 0,
    prepMinutes: plan ? plan.prepMinutes : PREP_MINUTES,
    arriveAt: plan ? plan.arriveAt : null,
    departAt: plan ? plan.departAt : null,
    // 카운트다운은 자리를 비워야 하는 시각까지 센다.
    targetAt: plan ? plan.awayAt : null,
    createdAt: now,
    createdBy: userId,
  };
}

function formatRemaining(minutes) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest}분`;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

function formatAwayHeadline(message, awayTime) {
  const reason = String(message || '').trim();
  const headline = `${String(awayTime || '').trim()}에 자리 비움`;
  return reason ? `${headline} | ${reason}` : headline;
}

// 저장해 둔 값이 없는 옛 기록도 그려져야 한다. 그때는 targetAt이 곧 출발이었고
// 이동시간도 준비시간도 없었다.
function readAwayTimes(state) {
  const awayAt = Number(state.targetAt);
  const departAt = Number.isFinite(Number(state.departAt)) ? Number(state.departAt) : awayAt;
  const arriveAt = Number.isFinite(Number(state.arriveAt)) ? Number(state.arriveAt) : departAt;
  return { awayAt, departAt, arriveAt };
}

function awayOverlaySnapshot(state, now = Date.now()) {
  if (!state || !Number.isFinite(Number(state.targetAt))) {
    return { active: false };
  }

  const { awayAt, departAt, arriveAt } = readAwayTimes(state);
  const awayTime = kstClock(awayAt);
  const departTime = kstClock(departAt);
  const arriveTime = kstClock(arriveAt);

  return {
    active: true,
    message: String(state.message || ''),
    departureTime: String(state.departureTime || '') || arriveTime,
    awayTime,
    departTime,
    arriveTime,
    travelMinutes: Math.max(0, Math.floor(Number(state.travelMinutes) || 0)),
    headline: formatAwayHeadline(state.message, awayTime),
    targetAt: awayAt,
    minutesRemaining: minutesUntilDeparture(awayAt, now),
  };
}

// DM/응답으로 되돌려주는 확인 문구. 오버레이에 뜨는 것과 같은 두 줄을 보여줘서
// 잘못 적었으면 바로 알아채게 한다.
function awayOverlayReply(state, now = Date.now()) {
  const snapshot = awayOverlaySnapshot(state, now);
  if (!snapshot.active) return '시각을 못 읽었어';
  return `${snapshot.headline}\n${formatRemaining(snapshot.minutesRemaining)} 남음`;
}

function formatVoiceStatus(message, departureTime) {
  return `${String(message || '').trim()} | ${departureTime} 외출 예정`;
}

function selectAwayState(dataRoot, guildId) {
  const guilds = dataRoot?.guilds || {};
  if (guildId) {
    return guilds[String(guildId)]?.settings?.awayCountdown || null;
  }

  const defaultGuildId = String(dataRoot?.meta?.defaultGuildId || '').trim();
  const defaultState = guilds[defaultGuildId]?.settings?.awayCountdown;
  if (defaultState) return defaultState;

  let newestState = null;
  for (const guild of Object.values(guilds)) {
    const state = guild?.settings?.awayCountdown || null;
    if (!state) continue;
    if (!newestState || Number(state.createdAt || 0) > Number(newestState.createdAt || 0)) {
      newestState = state;
    }
  }
  return newestState;
}

module.exports = {
  PREP_MINUTES,
  parseDepartureTime,
  parseDurationMinutes,
  kstClock,
  nextKstDepartureAt,
  minutesUntilDeparture,
  awayPlan,
  createAwayCountdown,
  awayOverlaySnapshot,
  formatRemaining,
  formatAwayHeadline,
  awayOverlayReply,
  formatVoiceStatus,
  selectAwayState,
};
