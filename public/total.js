if (!window.token) {
  window.token = localStorage.getItem("adminToken");
}

function kstNow() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

window.showTotal = async function () {

  const view = document.getElementById("view");
  if (!view) return;
await window.loadUsers(); // usersCache 채움




  
await window.loadUsers();
const users = window.usersCache;
const userId = this.value;

 view.innerHTML = `
    <div class="max-w-3xl mx-auto">
      <h2 class="text-2xl font-bold mb-4">Total</h2>
      <div id="totalTable"></div>
    </div>
  `;
;

  const tbody = document.getElementById("total-tbody");
  if (!tbody) return;
const data = await window.API.fetch("/total");   
const days = data.days || [];

  try {
   

tbody.innerHTML = days.map(d => `
  <tr>
    <td class="flex gap-2">

      ${d.dayKey}
    </td>
    <td>${(d.totalSec/3600).toFixed(1)}h</td>
  </tr>
`).join("");

  } catch (err) {
    console.error("Total 로딩 실패:", err);
  }
document.getElementById("totalTable").innerHTML = `...`;
};
