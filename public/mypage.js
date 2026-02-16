
// 모든 .js 파일 상단 공통 권장 사항
if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}


  console.log("mypage loaded");
 
document.getElementById("mypageGrid")

window.showMyPage = async function () {
    //  const thisWeek = days.filter(d => {
    //   const date = new Date(d.dayKey);
    //   return date >= weekStart;
    // });
  const res = await fetch(`/today?token=${encodeURIComponent(window.token)}`)
  const data = await res.json();
const finalUsers = data.finalUsers || [];
  const view = document.getElementById("view");
    const tbody = document.getElementById("mypage-tbody");

  view.innerHTML = `
  <div>
    <h2 class="text-3xl font-bold mb-6">My Page</h2>
    <div id="mypageGrid"></div>
  </div>
`;

const list = document.getElementById("mypageGrid");  list.innerHTML = finalUsers.map(user => {

    const percent = user.goalSec
      ? Math.min(100, Math.floor((user.totalSec / user.goalSec) * 100))
      : 0;

    return `
      <div class="bg-white p-6 rounded-xl shadow mb-6">

        <div class="font-bold text-lg">${user.name}</div>

        <div class="text-sm mt-2">
          🔥 연속 ${user.streak || 0}일
        </div>

        <div class="w-full bg-slate-200 rounded-full h-2 mt-2">
          <div 
            class="bg-blue-500 h-2 rounded-full transition-all duration-700"
            style="width:${percent}%">
          </div>
        </div>

        <div class="grid grid-cols-7 gap-1 mt-4">
          ${Array.from({length: 30}).map((_, i) => {

            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayKey = date.toISOString().slice(0,10);

            return `

              <div class="w-6 h-6 rounded ${
                user.attendance?.includes(dayKey)
                  ? `bg-green-500`
                  : `bg-slate-200`
              }"></div>
            `;

          }).join(``)}
        </div>

      </div>
    `;

  }).join("");
const mypage = data.maypage || []; 
tbody.innerHTML = mypage.map(d => `
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
};

window.renderCalendar = function (days)  {
  const grid = document.getElementById("calendarGrid");
  if (!grid) return;

  grid.innerHTML = "";

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const lastDate = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= lastDate; d++) {
    const dateStr = new Date(year, month, d)
      .toISOString()
      .slice(0, 10);

    const found = days.find(day => day.dayKey === dateStr);

    grid.innerHTML += `
      <div class="aspect-square flex items-center justify-center rounded-lg text-sm
        ${found ? "bg-green-400 text-white" : "bg-slate-200 dark:bg-slate-700"}">
        ${d}
      </div>
    `;
  }
}



window.saveMemo =  async function(userId){
  const memoInput = document.getElementById(`memo-${userId}`);
  const memo = memoInput.value;

  await fetch(`/today?token=${encodeURIComponent(window.token)}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
body: JSON.stringify({ userId: nicknameInput, minutes })
 };
  alert("메모 저장 완료");

}
