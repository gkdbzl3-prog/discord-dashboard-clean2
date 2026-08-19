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

function parseAwayShortcut(content) {
  const value = String(content || "").trim();
  const untilMatch = /^~(\d{2}):(\d{2})까지 함$/.exec(value);
  if (untilMatch) {
    const hour = Number(untilMatch[1]);
    const minute = Number(untilMatch[2]);
    if (hour > 23 || minute > 59) return null;

    const time = `${untilMatch[1]}:${untilMatch[2]}`;
    return { time, status: `⏳ ${time}까지 함` };
  }

  const rangeMatch =
    /^~(\d{2}):(\d{2})부터 (\d{2}):(\d{2})까지 자리 비움$/.exec(value);
  if (!rangeMatch) return null;

  const startHour = Number(rangeMatch[1]);
  const startMinute = Number(rangeMatch[2]);
  const endHour = Number(rangeMatch[3]);
  const endMinute = Number(rangeMatch[4]);
  if (startHour > 23 || startMinute > 59 || endHour > 23 || endMinute > 59) {
    return null;
  }

  const startTime = `${rangeMatch[1]}:${rangeMatch[2]}`;
  const endTime = `${rangeMatch[3]}:${rangeMatch[4]}`;
  return {
    startTime,
    endTime,
    status: `🚪 ${startTime}부터 ${endTime}까지 자리 비움`,
  };
}

async function executeAwayShortcut({
  content,
  isAdmin,
  now = Date.now(),
  deleteTrigger,
  onDeleteError = () => {},
  activate,
}) {
  const shortcut = parseAwayShortcut(content);
  if (!shortcut || !isAdmin) return false;

  try {
    await deleteTrigger();
  } catch (error) {
    onDeleteError(error);
  }

  if (shortcut.time) {
    await activate({
      time: shortcut.time,
      endAt: parseKstAwayEndAt(shortcut.time, now),
      status: shortcut.status,
    });
    return true;
  }

  const startAt = parseKstAwayEndAt(shortcut.startTime, now);
  await activate({
    startTime: shortcut.startTime,
    endTime: shortcut.endTime,
    startAt,
    endAt: parseKstAwayEndAt(shortcut.endTime, startAt),
    status: shortcut.status,
  });
  return true;
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
  executeAwayShortcut,
  getAwayReservationPhase,
  parseAwayShortcut,
  parseKstAwayEndAt,
  saveAwayReservation,
  setVoiceChannelStatus,
};
