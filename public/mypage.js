// mypage.js – 개인/공용 선택, 유저 선택, 닉네임 표시

if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}


window.showMyPage = async function () {
  const view = document.getElementById("view");
  view.innerHTML = `<div id="mypageGrid" class="space-y-6"></div>`;
await window.loadUsers();
  const u = window.usersCache.find(x => x.id === userId);
const users = window.usersCache;
  const grid = document.getElementById("mypageGrid");

  const data = await window.API.fetch("/days");
  const days = data.days || [];

  const byUser = new Map();

  days.forEach(d => {
    d.users.forEach(u => {
      if (!byUser.has(u.id)) {
        byUser.set(u.id, {
          name: u.name,
          avatar: u.avatar,
          total: 0
        });
      }
      byUser.get(u.id).total += u.seconds || 0;
    });
  });

 

  grid.innerHTML = users.map(u => `
    <div class="bg-white p-5 rounded-2xl shadow flex items-center gap-4">
      <img src="${u.avatar}" class="w-14 h-14 rounded-full"/>
      <div>
        <div class="font-bold">${u.name}</div>
        <div class="text-sm text-gray-500">
          ${(u.total/3600).toFixed(1)}h total
        </div>
      </div>
    </div>
  `).join("");
};


window.saveMemo = async function (userId) {
  const memoInput = document.getElementById("memo-" + userId);
  if (!memoInput) return;
  const memo = memoInput.value;

  try {
    const res = await fetch("/memo?token=" + encodeURIComponent(window.token), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, memo })
    });
    if (res.ok) alert("메모 저장 완료");
  } catch (e) {
    alert("메모 저장 실패");
  }
 saveData(data);
};