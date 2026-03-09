window.showTomorrow = async function () {
  await window.loadUsers();

  const data = await window.API.fetch("/today");
  const users = Array.isArray(data.users)
    ? data.users
    : Object.values(data.users || {});

  const view = document.getElementById("view");
  if (!view) return;

  view.innerHTML = `
    <h2>Tomorrow</h2>
    <div id="tomorrowGrid" class="tomorrow-grid"></div>
  `;

  const grid = document.getElementById("tomorrowGrid");
  if (!grid) return;

  const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

  grid.innerHTML = users
    .filter(u => u && u.id)
    .map((u) => {
      const avatarUrl =
        u.avatar && u.avatar !== "null" ? u.avatar : DEFAULT_AVATAR;

      return `
        <div class="user-card" data-id="${u.id}">
          <img class="avatar" src="${avatarUrl}" onerror="this.src='${DEFAULT_AVATAR}'">
          <div class="user-name">${u.nickname || u.name || "Unknown"}</div>
        </div>
      `;
    })
    .join("");
};
