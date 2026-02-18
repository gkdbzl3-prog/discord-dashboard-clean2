// today.js – Today 메인 표시, 중복/불필요 함수 제거

if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}



window.formatTime = function (seconds) {
  if (!seconds) return "0분";
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return hrs > 0 ? `${hrs}시간 ${remainMins}분` : `${mins}분`;
};




function renderLiveUsers() {

  const liveUsers = window.usersCache.filter(u => u.online);

  const area = document.getElementById("liveArea");
  if (!area) return;

  if (liveUsers.length === 0) {
    area.innerHTML = `
      <div class="text-center text-gray-400">
        현재 활동 중인 유저 없음
      </div>
    `;
    return;
  }

  area.innerHTML = `
    <div class="flex gap-4 justify-center flex-wrap">
      ${liveUsers.map(u => `
        <div class="text-center">
          <img src="${u.avatar}" class="w-14 h-14 rounded-full mx-auto">
          <div class="text-sm mt-1 font-medium">${u.name}</div>
          <div class="text-xs text-green-500">LIVE 🔥</div>
        </div>
      `).join("")}
    </div>
  `;
}




window.renderTimeline = function (users) {

  const container = document.getElementById("timeline");

  container.innerHTML = users.map(u => `
    <div class="tweet">
      <img src="${u.avatar}" class="avatar">
      <div class="tweet-body">
        <div class="tweet-header">
          <span class="name">${u.name}</span>
          <span class="handle">@${u.id.slice(0,6)}</span>
          ${u.isStudying ? '<span class="status online">● Online</span>' : ''}
        </div>

        <div class="tweet-content">
          ${formatSeconds(u.todaySec || 0)}
        </div>
      </div>
    </div>
  `).join("");
}

window.calcTodayPercent = function (todaysec, goalSec) {
  if (!goalSec || goalSec === 0) return 0;
  return Math.min(100, Math.round((todaysec / goalSec) * 100));
};



window.showToday = async function () {


  await window.loadUsers();

  const view = document.getElementById("view");
  if (!view) return;

  const data = await window.API.fetch("/today");
  const users = data.users ||[];


  view.innerHTML = `
    <div class="max-w-2xl mx-auto">

      <h2 class="text-xl font-bold mb-4">Today</h2>
    <div id="timeline"></div>
      <div id="liveArea" class="mb-6"></div>

  `;
const timeline = document.getElementById("timeline");

 users.forEach(u => {
    timeline.innerHTML += `
      <div class="tweet-card">
        <img src="${u.avatar || defaultAvatar}" class="avatar">
onclick="window.showMyPage('${u.id}')"
        <div class="tweet-body">
          <div class="tweet-header">
            <span class="name">${u.name}</span>
            <span class="id">@${u.id.slice(0,6)}</span>
            <span class="online">${u.online ? "●" : ""}</span>
          </div>
          <div class="tweet-content">
            오늘 공부 ${Math.floor((u.totalSeconds || 0)/60)}분
          </div>
        </div>
      </div>
    `;
  });



const timelineHtml = users.map(u => `
  <div class="tweet">
    <img src="${u.avatar}" class="avatar">
    <div>
      <div class="name">
        ${u.name} <span>@${u.id}</span>
      </div>
      <div class="content">
        ${formatSessions(u)}
      </div>
    </div>
  </div>
`).join("");

document.getElementById("view").innerHTML = timelineHtml;
  renderLiveUsers();
  renderTimeline();


};