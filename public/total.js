if (!window.token) {
  window.token = localStorage.getItem("adminToken");
}

window.showTotal = async function () {
  const res = await fetch(`/days?token=${encodeURIComponent(window.token)}`);
    const data = await res.json();  
  const view = document.getElementById("view");
  view.innerHTML = `
    <main class="max-w-7xl mx-auto px-6 py-10">
      <h1 class="text-3xl font-bold text-primary mb-6">
        Total Log
      </h1>

      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead class="bg-slate-50 dark:bg-slate-800">
  
            <tr>
              <th class="px-6 py-4 text-xs uppercase tracking-wider text-slate-500">
                Date
              </th>
              <th class="px-6 py-4 text-xs uppercase tracking-wider text-slate-500 text-right">
                Total Time
              </th>
            </tr>
          </thead>
          <tbody id="total-tbody"></tbody>
        </table>
      </div>
    </main>
  `;

  try {

    

    const days = data.days || [];
    const user = data.users || [];
  const d = new Date(kstNow);

    const tbody = document.getElementById("total-tbody");
    if (!tbody) return;

    if (!days.length) {
      tbody.innerHTML = `<tr><td colspan="2">기록이 없습니다</td></tr>`;
      return;
    }

d.users.map(user => `
  <img src="${user.avatar}">
`)
    tbody.innerHTML = days.map(d => `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800 transition">
        <tr>
    <td>${d.dayKey}</td>
 <td>${(d.totalSec / 3600).toFixed(1)}h</td> 
 ${(d.totalSec / 3600).toFixed(1)}h
  
      </tr>
    `).join("");

  } catch (err) {

    console.error("Total 로딩 실패:", err);

    view.innerHTML = `
      <div class="p-6 text-red-500">
        데이터를 불러오지 못했어 😢
      </div>
    `;
  }
};