const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const CLOCK_RE = /\d{2}:\d{2}/g;
const AWAY_CONTENT_ERROR =
  "내용은 ‘밥 먹으러 감 00:30까지’처럼 끝나는 시각(HH:MM)을 넣어 주세요.";

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

// 메시지는 손대지 않고 그대로 채널 상태로 쓴다.
// 안에 적힌 마지막 HH:MM만 읽어 상태가 사라질 시각으로 삼는다.
function createAwayReservationFromInput(content, now = Date.now()) {
  const status = String(content || "").trim();
  const time = (status.match(CLOCK_RE) || [])
    .reverse()
    .find((value) => {
      const [hour, minute] = value.split(":").map(Number);
      return hour <= 23 && minute <= 59;
    });

  if (!status || !time) throw new Error(AWAY_CONTENT_ERROR);
  return { time, endAt: parseKstAwayEndAt(time, now), status };
}

function getAwayReservationPhase(reservation, now = Date.now()) {
  const endAt = Number(reservation?.endAt);
  if (!Number.isFinite(endAt)) return "invalid";
  if (endAt <= now) return "expired";
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
  clearAwayReservation,
  createAwayReservationFromInput,
  getAwayReservationPhase,
  parseKstAwayEndAt,
  saveAwayReservation,
  setVoiceChannelStatus,
};
