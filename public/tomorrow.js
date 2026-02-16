window.showTomorrow = async function () {

  const view = document.getElementById("view");

  const res = await fetch(`/today?token=${encodeURIComponent(window.token)}`);
  const data = await res.json();

  const users = data.finalUsers || [];

  view.innerHTML = `
    <h2 class="text-2xl font-bold mb-6">Tomorrow</h2>
    <div id="tomorrowGrid" class="grid gap-4"></div>
  `;

  const grid = document.getElementById("tomorrowGrid");

  grid.innerHTML = users.map(user => {

    const percent = user.goalSec
      ? Math.min(100, Math.floor((user.totalSec / user.goalSec) * 100))
      : 0;

    return `
      <div class="p-4 bg-white rounded-xl shadow">
        ${user.badge ? `<div class="text-orange-500">${user.badge}</div>` : ""}
        <img src="${user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
             class="w-12 h-12 rounded-full"/>
        <div>${user.name}</div>
        <div>${percent}%</div>
      </div>
    `;
  }).join("");
};