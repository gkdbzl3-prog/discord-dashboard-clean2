const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDepartureTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || '').trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
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

function formatAwayHeadline(message, departureTime) {
  const reason = String(message || '').trim();
  const headline = `${String(departureTime || '').trim()}에 자리 비움`;
  return reason ? `${headline} | ${reason}` : headline;
}

function awayOverlaySnapshot(state, now = Date.now()) {
  if (!state || !Number.isFinite(Number(state.targetAt))) {
    return { active: false };
  }

  return {
    active: true,
    message: String(state.message || ''),
    departureTime: String(state.departureTime || ''),
    headline: formatAwayHeadline(state.message, state.departureTime),
    targetAt: Number(state.targetAt),
    minutesRemaining: minutesUntilDeparture(state.targetAt, now),
  };
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
  parseDepartureTime,
  nextKstDepartureAt,
  minutesUntilDeparture,
  awayOverlaySnapshot,
  formatAwayHeadline,
  formatVoiceStatus,
  selectAwayState,
};
