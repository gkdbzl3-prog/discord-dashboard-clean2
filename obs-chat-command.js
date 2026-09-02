const { parseDepartureTime } = require('./away-countdown');

const MAX_MESSAGE_LENGTH = 100;
const CLEAR_KEYWORDS = new Set(['끄기', 'off']);

// `!obs` 뒤에 영숫자가 붙으면 다른 명령이다 (`!obsessed`). 한글 `끄기`는
// 붙여 쓰는 게 자연스러워서 공백 없이도 받는다.
const OBS_COMMAND = /^!obs(?![a-z0-9])\s*(.*)$/i;

function parseObsChatCommand(content) {
  const match = OBS_COMMAND.exec(String(content || '').trim());
  if (!match) return null;

  const rest = match[1].trim().replace(/\s+/g, ' ');
  if (CLEAR_KEYWORDS.has(rest.toLowerCase())) {
    return { action: 'clear' };
  }

  const [departureTime, ...messageParts] = rest.split(' ');
  if (!parseDepartureTime(departureTime)) {
    return { action: 'invalid', reason: 'time' };
  }

  const message = messageParts.join(' ');
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { action: 'invalid', reason: 'too-long' };
  }

  return { action: 'set', departureTime, message };
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

module.exports = { parseObsChatCommand, resolveObsGuildId, MAX_MESSAGE_LENGTH };
