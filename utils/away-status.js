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
  parseKstAwayEndAt,
  saveAwayReservation,
  setVoiceChannelStatus,
};
