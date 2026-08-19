const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseKstAwayEndAt(time, now = Date.now()) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(time || "").trim());
  if (!match) throw new Error("시간은 HH:MM 형식으로 입력해 주세요.");

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error("시간은 HH:MM 형식으로 입력해 주세요.");
  }

  const kstNow = new Date(now + KST_OFFSET_MS);
  const kstDayStartUtc = Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate(),
  );
  let endAt = kstDayStartUtc - KST_OFFSET_MS + (hour * 60 + minute) * 60_000;
  if (endAt <= now) endAt += DAY_MS;
  return endAt;
}

function buildAwayStatus(time, message) {
  const prefix = String(message || "").trim();
  const suffix = `${time}까지 자리 비움`;
  return prefix ? `${prefix} | ${suffix}` : suffix;
}

const AWAY_EMOJI_RULES = [
  [/밥|식사|점심|저녁|아침|먹/, "🍚"],
  [/커피|카페|음료|차 마/, "☕"],
  [/병원|약국|치과|진료|검진/, "🏥"],
  [/운동|헬스|산책|달리|러닝|등산/, "🏃"],
  [/샤워|씻|목욕|머리 감/, "🚿"],
  [/낮잠|취침|수면|자러|잘게|눕/, "😴"],
  [/청소|빨래|설거지|정리/, "🧹"],
  [/공부|작업|집중|함$/, "⏳"],
];
const DEFAULT_AWAY_EMOJI = "🚪";
const DEFAULT_RANGE_LABEL = "자리 비움";
const AWAY_CONTENT_ERROR =
  "내용은 ‘🍚 밥 먹으러 감 00:30까지’ 또는 ‘13:00부터 15:00까지 자리 비움’ 형식으로 입력해 주세요.";

const TIME_SOURCE = String.raw`(\d{2}):(\d{2})`;
const AWAY_RANGE_RE = new RegExp(`^${TIME_SOURCE}부터 ${TIME_SOURCE}까지(?:\\s+(.*))?$`);
const AWAY_LABEL_FIRST_RE = new RegExp(`^(.+?)\\s+${TIME_SOURCE}까지$`);
const AWAY_TIME_FIRST_RE = new RegExp(`^${TIME_SOURCE}까지\\s+(.+)$`);

function isValidClockTime(hour, minute) {
  return hour <= 23 && minute <= 59;
}

function decorateAwayLabel(label) {
  const text = String(label || "").trim();
  if (!text) return `${DEFAULT_AWAY_EMOJI} ${DEFAULT_RANGE_LABEL}`;
  if (/^\p{Extended_Pictographic}/u.test(text)) return text;

  const rule = AWAY_EMOJI_RULES.find(([pattern]) => pattern.test(text));
  return `${rule ? rule[1] : DEFAULT_AWAY_EMOJI} ${text}`;
}

function buildAwayChannelStatus(label, endTime) {
  return `${decorateAwayLabel(label)} · ${endTime}까지`;
}

function createAwayReservationFromInput(content, now = Date.now()) {
  const value = String(content || "").trim();

  const rangeMatch = AWAY_RANGE_RE.exec(value);
  if (rangeMatch) {
    const [, startHour, startMinute, endHour, endMinute, label = ""] = rangeMatch;
    if (
      isValidClockTime(Number(startHour), Number(startMinute)) &&
      isValidClockTime(Number(endHour), Number(endMinute))
    ) {
      const startTime = `${startHour}:${startMinute}`;
      const endTime = `${endHour}:${endMinute}`;
      const startAt = parseKstAwayEndAt(startTime, now);
      return {
        startTime,
        endTime,
        startAt,
        endAt: parseKstAwayEndAt(endTime, startAt),
        status: buildAwayChannelStatus(label, endTime),
      };
    }
    throw new Error(AWAY_CONTENT_ERROR);
  }

  const labelFirst = AWAY_LABEL_FIRST_RE.exec(value);
  const timeFirst = labelFirst ? null : AWAY_TIME_FIRST_RE.exec(value);
  const single = labelFirst
    ? { label: labelFirst[1], hour: labelFirst[2], minute: labelFirst[3] }
    : timeFirst
      ? { label: timeFirst[3], hour: timeFirst[1], minute: timeFirst[2] }
      : null;

  if (single && isValidClockTime(Number(single.hour), Number(single.minute))) {
    const time = `${single.hour}:${single.minute}`;
    return {
      time,
      endAt: parseKstAwayEndAt(time, now),
      status: buildAwayChannelStatus(single.label, time),
    };
  }

  throw new Error(AWAY_CONTENT_ERROR);
}
function getAwayReservationPhase(reservation, now = Date.now()) {
  const endAt = Number(reservation?.endAt);
  if (!Number.isFinite(endAt)) return "invalid";
  if (endAt <= now) return "expired";

  const startAt = reservation?.startAt == null ? null : Number(reservation.startAt);
  if (startAt !== null && !Number.isFinite(startAt)) return "invalid";
  if (startAt !== null && startAt > now) return "pending";
  return "active";
}

function ensureReservations(root) {
  root.meta ??= {};
  root.meta.awayReservations ??= {};
  return root.meta.awayReservations;
}

function saveAwayReservation(root, guildId, reservation) {
  ensureReservations(root)[String(guildId)] = { ...reservation };
}

function clearAwayReservation(root, guildId) {
  const reservations = ensureReservations(root);
  const key = String(guildId);
  const previous = reservations[key] || null;
  delete reservations[key];
  return previous;
}

async function setVoiceChannelStatus(rest, channelId, status) {
  await rest.put(`/channels/${channelId}/voice-status`, {
    body: { status: status || null },
  });
}

module.exports = {
  buildAwayStatus,
  clearAwayReservation,
  createAwayReservationFromInput,
  getAwayReservationPhase,
  parseKstAwayEndAt,
  saveAwayReservation,
  setVoiceChannelStatus,
};
