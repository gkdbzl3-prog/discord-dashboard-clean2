// 스터디 음성채널이 빈 방으로 보이지 않게 봇이 대신 앉아 있는다.
// 사람이 둘 이상 모이면 자리를 비켜준다.
const CROWD_THRESHOLD = 2;

function countStudyChannelHumans(channel) {
  if (!channel?.members?.filter) return 0;
  return channel.members.filter((member) => !member.user?.bot).size;
}

function decideStudyVcAction({ humanCount, connected }) {
  if (humanCount >= CROWD_THRESHOLD) {
    return connected ? 'leave' : 'stay';
  }
  return connected ? 'stay' : 'join';
}

module.exports = { countStudyChannelHumans, decideStudyVcAction, CROWD_THRESHOLD };
