if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}
 
  



window.showWeekly = async function () {

  const view = document.getElementById("view");


  try {
 

const res = await fetch(`/days?token=${encodeURIComponent(window.token)}`);
const data = await res.json();
   const days = data.days || [];
    // 🔥 금요일 시작 계산
    const now = new Date();
    const weekStart = new Date(now);
    const diff = (now.getDay() - 5 + 7) % 7;
    weekStart.setDate(now.getDate() - diff);
    weekStart.setHours(0,0,0,0);

    const thisWeek = days.filter(d => {
      const date = new Date(d.dayKey);
      return date >= weekStart;
    });
    const tbody = document.getElementById("days-tbody");
    let totalSec = 0;
    thisWeek.forEach(d => {
      totalSec += d.totalSec || 0;
    });

    const totalMin = Math.floor(totalSec / 60);
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;

    view.innerHTML = `
      <main class="max-w-7xl mx-auto px-6 py-10">

        <h1 class="text-3xl font-bold text-primary mb-2">
          Weekly Log
        </h1>

        <p class="text-sm text-gray-400 mb-1">
          (금요일 시작 기준)
        </p>

        <p class="text-lg font-semibold text-primary mb-6">
          이번 주 총합: ${hours}시간 ${minutes}분
        </p>

        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden">
          <table class="w-full text-left border-collapse">
            <thead class="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th class="px-6 py-4 text-xs uppercase">Date</th>
                <th class="px-6 py-4 text-xs uppercase text-right">Total</th>
              </tr>
            </thead>
          </table>
        </div>

      </main>
    `;
tbody.innerHTML = days.map(d => `
  <tr>
    <td class="flex items-center gap-2">
      ${d.users.map(user => `
        <img src="${user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
             class="w-6 h-6 rounded-full"/>
      `).join("")}
      ${d.dayKey}
    </td>
    <td class="text-right">${(d.totalSec/3600).toFixed(1)}h</td>
  </tr>
`).join("");
  } catch (err) {

    console.error("Weekly 로딩 실패:", err);
    view.innerHTML = `<div class="p-6 text-red-500">로딩 실패 😢</div>`;

  }
}













document.addEventListener("DOMContentLoaded", async () => {

const res = await fetch(`/days?token=${encodeURIComponent(window.token)}`);
const data = await res.json();

const days = data.days || [];

// 금요일 기준 주 시작
const now = new Date();
const weekStart = new Date(now);
const diff = (now.getDay() - 5 + 7) % 7;
weekStart.setDate(now.getDate() - diff);
weekStart.setHours(0,0,0,0);

// 이번 주만 필터
const thisWeek = days.filter(d => {
  const date = new Date(d.dayKey);
  return date >= weekStart;
});

// 👉 여기서 계산
const totalSec = days.reduce(
  (sum, d) => sum + (d.totalSec || 0),
  0
);


const weekTotalSec = thisWeek.reduce(
  (sum, d) => sum + (d.totalSec || 0),
  0
);

const hours = Math.floor(weekTotalSec / 3600);
const totalMin = Math.floor(totalSec / 60);
const minutes = totalMin % 60;

// 👉 그 다음에 출력


const totalEl = document.getElementById("weeklyTotalDisplay");

if (totalEl && typeof hours !== "undefined" && typeof minutes !== "undefined") {
  totalEl.innerText = `${hours}h ${minutes}m`;
}
});


