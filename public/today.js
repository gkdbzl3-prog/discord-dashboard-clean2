
  // 모든 .js 파일 상단 공통 권장 사항
if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}
const today = data.today || []; 
window.generateDateKey = function (offset) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}


window.showToday = async function () {

  const view = document.getElementById("view");
   const tbody = document.getElementById("today-tbody");
  const res = await fetch(`/today?token=${encodeURIComponent(window.token)}`);
  const data = await res.json();

  const finalUsers = data.finalUsers || [];

  view.innerHTML = `
    <h2 class="text-2xl font-bold mb-6">Today</h2>
    <div id="todayGrid"></div>
  `;
tbody.innerHTML = today.map(d => `
  <tr>
    <td class="flex items-center gap-2">
      ${d.users.map(u => `
        <img src="${u.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
             class="w-6 h-6 rounded-full"/>
      `).join("")}
      ${d.dayKey}
    </td>
    <td class="text-right">${(d.totalSec/3600).toFixed(1)}h</td>
  </tr>
`).join("");
  renderTodayCards(finalUsers);
};



window.renderToday = async function () {

  const view = document.getElementById("view");

  try {
    const res = await fetch(`/today?token=${encodeURIComponent(window.token)}`);
    const data = await res.json();

    renderTodayCards(data.finalUsers || []);

  } catch (err) {
    view.innerHTML = "로딩 실패";
  }
};


window.renderTodayCards = function (finalUsers) {
  const grid = document.getElementById("todayGrid");
//  const thisWeek = days.filter(d => {
//       const date = new Date(d.dayKey);
//       return date >= weekStart;
//     });
  if (!grid) return;

  grid.innerHTML = finalUsers.map(user => {
    const percent = user.goalSec
      ? Math.min(100, Math.floor((user.totalSec / user.goalSec) * 100))
      : 0;

    return `
      <div class="p-4 bg-white rounded-xl shadow">

        <div class="font-bold">${user.name}</div>
        <div>${percent}%</div>
      </div>
    `;
  }).join("");
};






window.renderProgress = function (d) {
  const percent = user.goalSec
    ? Math.min(100, Math.floor(d.ttodaysec / d.goalSec * 100))
    : 0;

  return `
    <div class="progress">
      <div class="progress-bar" style="width:${percent}%"></div>
    </div>
  `;
}


window.calcTodayPercent = function(todaysec, goalSec) {
  if (!goalSec || goalSec === 0) return 0;
  return Math.min(100, Math.round((todaysec / goalSec) * 100));
};



// formatMin 헬퍼 함수 (없다면 추가)
window.formatMin = function (seconds) {
  if (!seconds) return '0분';
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  
  if (hrs > 0) {
    return `${hrs}시간 ${remainMins}분`;
  }
  return `${mins}분`;
}





