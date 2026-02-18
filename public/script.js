window.token =
  new URLSearchParams(location.search).get("token") ||
  localStorage.getItem("adminToken");

window.API = {};

// window.API.fetch = async function (path) {
// //   const res = await fetch(`${path}?token=${encodeURIComponent(window.token)}`);
// //   if (!res.ok) throw new Error("API error");
// //   return res.json();
// // };



console.log('token:', window.token);
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get("token");

if (tokenFromUrl) {
  localStorage.setItem("adminToken", tokenFromUrl);
}






window.defaultAvatar = "https://cdn.discordapp.com/embed/avatars/0.png";

window.getUsers = async function () {
  const data = await window.API.fetch("/manual-data");
  return data.finalUsers || [];
};


window.usersCache = [];

window.loadUsers = async function() {
  const data = await window.API.fetch("/manual-data");
  window.usersCache = data.finalUsers || [];
};


window.showSection = function (id) {
  document.querySelectorAll(".page-section").forEach(el => {
    el.style.display = "none";
  });

  document.getElementById(id).style.display = "block";
}

window.formatMinutes = function(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}시간 ${m}분`;
};
      
       



window.fadeOutIn = function (renderFn) {
  const view = document.getElementById("view");
if (!view) return;


  setTimeout(() => {
    renderFn();
    view.classList.remove("opacity-0", "translate-y-4", "blur-sm");
  }, 180);
};

window.loadingUI = () => `
  <div class="text-center py-20 text-primary font-bold animate-pulse">
    Loading...
  </div>
`;

window.errorUI = (msg) => `
  <div class="text-center py-20 text-red-500 font-bold">
    ${msg}
  </div>
`;




document.getElementById("fab").onclick = () => {
  window.showManual();
};



document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-page]");
  if (!btn) return;

  const page = btn.dataset.page;

  if (page === "today") window.showToday();
  if (page === "mypage") window.showMyPage();
  if (page === "manual") window.showManual();
if (page === "total") window.showTotal();
});

document.getElementById("todayUserSelect").onchange = function () {
  const id = this.value;               // 선택한 userId
  const u = window.usersCache.find(x => x.id === id);
  if (!u) return;

  document.getElementById("selectedAvatar").innerHTML = `
    <img src="${u.avatar || window.defaultAvatar}"
         class="w-10 h-10 rounded-full"
         onerror="this.src='${window.defaultAvatar}'" />
  `;

  // 타임라인도 u 기준으로 렌더
  renderTimelineForUser(u);
};
    
