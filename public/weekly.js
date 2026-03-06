// weekly.js – 최근 7일, 이름별 1줄 (같은 이름 합침), 리스트에는 이름만 표시

if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}





window.showWeekly = async function () {
await window.loadUsers();
  const view = document.getElementById("view");
  if (!view) return;

  view.innerHTML = `
    <h2>Weekly</h2>
    <table class="w-full">
      <thead>
        <tr>
          <th class="text-left">참여자</th>
          <th class="text-right">시간</th>
        </tr>
      </thead>
      <tbody id="weekly-tbody"></tbody>
    </table>
  `;

  const tbody = document.getElementById("weekly-tbody");
  if (!tbody) return;

  try {
    const data = await window.API.fetch("/weekly");
    const days = data.days || [];
    const weeklyUsers = Array.isArray(data.users)
      ? data.users
      : Object.values(data.users || {});
    const defaultAvatar =
      "https://cdn.discordapp.com/embed/avatars/0.png";

    const today = new Date();
    const last7 = days.filter(d => {
      if (!d.dayKey) return false;
      const dayDate = new Date(d.dayKey);
      const diffMs = today - dayDate;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays < 7;
    });

    // 이름(name) 기준으로 합치기 → 같은 "날", "gkdbzl2" 한 줄로
    const byName = new Map(); // displayName -> { name, avatar, seconds, id(대표) }

    last7.forEach(d => {
      (d.users || []).forEach(u => {
        if (!u.id) return;
        const displayName = (u.name || u.id || "").toString().trim() || "이름 없음";
        if (!byName.has(displayName)) {
          byName.set(displayName, {
            name: displayName,
            avatar: u.avatar || defaultAvatar,
            seconds: 0,
            id: u.id,
          });
        }
        const row = byName.get(displayName);
        row.seconds += u.seconds || 0;
      });
    });

    const stats = Array.from(byName.values()).sort((a, b) => b.seconds - a.seconds);

    if (stats.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="2" class="py-4 text-center text-slate-400">최근 7일 기록이 없습니다.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = stats
      .map(
        (u) => `
        <tr>
          <td class="py-2">
            <select id="todayUserSelect">
  <option value="">Nickname</option>
  ${weeklyUsers.map(user => `
    <option value="${user.id}">${user.name}</option>
  `).join("")}
</select>

<div id="selectedAvatar"></div>
          </td>
          <td class="py-2 text-right font-medium">${(u.seconds / 3600).toFixed(1)}h</td>
        </tr>
      `
      )
      .join("");
  } catch (err) {
    console.error("Weekly 로딩 실패:", err);
    tbody.innerHTML = '<tr><td colspan="2" class="text-red-500 py-4">로딩 실패</td></tr>';
  }
};