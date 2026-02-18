




window.showTomorrow = async function () {

await window.loadUsers();
const users = window.usersCache; // usersCache 채움

const view = document.getElementById("view");
  if (!view) return;

 
  view.innerHTML = `
    <h2>Tomorrow</h2>
    <div id="tomorrowGrid"></div>
  `;

  const grid = document.getElementById("tomorrowGrid");
  if (!grid) return;



  try {
   
    grid.innerHTML = users.map(u => `
 <div style="display:flex; flex-wrap:wrap; gap:6px; max-width:200px;">
  ${(d.users || []).map(u => `
    <img 
      src="${u.avatar || defaultAvatar}" 
      style="width:28px; height:28px; border-radius:50%; object-fit:cover;"
      onerror="this.src='${defaultAvatar}'"
    >
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