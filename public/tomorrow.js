




window.showTomorrow = async function () {

await window.loadUsers();
const { users } = await window.API.fetch("/today");

const view = document.getElementById("view");
  if (!view) return;

 
  view.innerHTML = `
    <h2>Tomorrow</h2>
    <div id="tomorrowGrid"></div>
  `;

  const grid = document.getElementById("tomorrowGrid");
const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";
const avatarUrl =
  user.avatar && user.avatar !== "null"
    ? user.avatar
    : DEFAULT_AVATAR;
  if (!grid) return;



  try {
   
    grid.innerHTML = users.map(u => `
 <div style="display:flex; flex-wrap:wrap; gap:6px; max-width:200px;">
  ${(d.users || []).map(u => `
   <img class="avatar"
     src="${avatarUrl}"
     onerror="this.src='${DEFAULT_AVATAR}'">
  `).join("")}
</div>
              <select id="todayUserSelect">
  <option value="">Nickname</option>
  ${users.map(u => `
    <option value="${u.id}">${u.name}</option>
  `).join("")}
</select>
    `).join("");

  } catch (err) {
    console.error(err);
  }
};