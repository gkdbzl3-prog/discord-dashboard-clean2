const { parseDepartureTime, parseDurationMinutes } = require('./away-countdown');

const MAX_MESSAGE_LENGTH = 100;
const CLEAR_KEYWORDS = new Set(['끄기', 'off']);

// `!obs` 뒤에 영숫자가 붙으면 다른 명령이다 (`!obsessed`). 한글 `끄기`는
// 붙여 쓰는 게 자연스러워서 공백 없이도 받는다.
const OBS_COMMAND = /^!obs(?![a-z0-9])\s*(.*)$/i;

// 한 칸에 통째로 적게 하고 봇이 시각만 뽑아낸다. 시각을 맨 앞에 두라고
// 요구하지 않는 건, 별도 입력 칸을 두면 그 칸이 비어 있는 채로 전송되기
// 때문이다(실제로 그렇게 사유가 통째로 날아간 적이 있다).
//
// 시각은 출발 시각, 단위가 붙은 숫자는 약속 장소까지 걸리는 시간이다.
// `1시간 20분`처럼 띄어 쓸 수 있으니 나온 것들을 모두 더한다.
function parseObsInput(text) {
  const words = String(text || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  const timeIndex = words.findIndex((word) => parseDepartureTime(word));
  if (timeIndex === -1) {
    return { action: 'invalid', reason: 'time' };
  }

  const departureTime = words[timeIndex];
  let travelMinutes = 0;
  const rest = [];
  words.forEach((word, index) => {
    if (index === timeIndex) return;
    const minutes = parseDurationMinutes(word);
    if (minutes === null) {
      rest.push(word);
      return;
    }
    travelMinutes += minutes;
  });

  const message = rest.join(' ');
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { action: 'invalid', reason: 'too-long' };
  }

  return { action: 'set', departureTime, travelMinutes, message };
}

function parseObsChatCommand(content) {
  const match = OBS_COMMAND.exec(String(content || '').trim());
  if (!match) return null;

  const rest = match[1].trim().replace(/\s+/g, ' ');
  if (CLEAR_KEYWORDS.has(rest.toLowerCase())) {
    return { action: 'clear' };
  }

  return parseObsInput(rest);
}

// 채널에 흔적을 남기지 않는 게 목적이라 DM과 로그 채널에서만 받는다.
function isObsChannelAllowed({ isDirectMessage, channelId, logChannelId } = {}) {
  if (isDirectMessage) return true;
  const allowed = String(logChannelId || '').trim();
  return !!allowed && String(channelId) === allowed;
}

// DM에는 서버가 없으니 어느 서버의 카운트다운을 건드릴지 정해야 한다.
// 설정된 곳을 우선하되, 봇이 실제로 들어가 있는 서버만 후보로 본다.
function resolveObsGuildId(dataRoot, env = {}, guildIds = []) {
  const joined = new Set(guildIds.map((id) => String(id)));
  const configured = [
    dataRoot?.meta?.defaultGuildId,
    env.DEFAULT_GUILD_ID,
    env.GUILD_ID,
  ];

  for (const candidate of configured) {
    const id = String(candidate || '').trim();
    if (id && joined.has(id)) return id;
  }

  return joined.size === 1 ? [...joined][0] : null;
}

module.exports = {
  parseObsChatCommand,
  parseObsInput,
  isObsChannelAllowed,
  resolveObsGuildId,
  MAX_MESSAGE_LENGTH,
};
