if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}



// script.js 상단에 한 번만!
window.token = new URLSearchParams(location.search).get('token') || localStorage.getItem("adminToken");

console.log('token:', window.token);
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get("token");

if (tokenFromUrl) {
  localStorage.setItem("adminToken", tokenFromUrl);
}
// 모든 .js 파일 상단 공통 권장 사항
if (!window.token) {
    window.token = new URLSearchParams(location.search).get('token') || localStorage.getItem("adminToken");
}



document.addEventListener("click", (e) => {

  const btn = e.target.closest("[data-page]");
  if (!btn) return;

  const page = btn.dataset.page;
  console.log("page clicked:", page);

  if (page === "today") window.showToday?.();
  else if (page === "weekly") window.showWeekly?.();
  else if (page === "mypage") window.showMyPage?.();
  else if (page === "manual") window.showManual?.();
  else if (page === "total") window.showTotal?.();



});



window.formatMinutes = function(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}시간 ${m}분`;
};
      
       



window.setGoal = function() {
  const min = Number(document.getElementById('goal-input').value);
  if (!min) return alert('분 단위로 입력해줘');

  fetch(`/today?token=${encodeURIComponent(window.token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ userId: nicknameInput, minutes })  })
  .then(() => {
    alert('목표 저장 완료');
    show('today');
  });
}




window.send = function () {
  const uId = document.getElementById('uid').value;
  const min = Number(document.getElementById('min').value);

  fetch(`/today?token=${encodeURIComponent(window.token)}`, 
{
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ userId: nicknameInput, minutes })  }).then(() => alert('추가됨'));
}


 





// script.js (브라우저용)
window.API = window.API || {};

window.API.fetch = async function (path) {
    // 1. 사용할 토큰을 확정합니다.
    const currentToken = window.token || localStorage.getItem("adminToken"); 

    if (!currentToken) {
        console.error("토큰이 없습니다!");
        throw new Error("No Token");
    }

    // 2. path 뒤에 토큰을 붙여서 요청합니다.
    // 주의: path 자체에 이미 ?가 있으면 &를 써야 하지만, 보통은 ?를 씁니다.
    const res = await fetch(`${path}?token=${encodeURIComponent(window.token)}`
);

    
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "API Error");
    }

    return res.json();
};



window.fadeOutIn = function (renderFn) {
  const view = document.getElementById("view");



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







document.querySelectorAll("[data-page]").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    window[`show${page.charAt(0).toUpperCase() + page.slice(1)}`]?.();
  });
});
  



document.addEventListener("DOMContentLoaded", () => {
  window.showToday?.();
});



    
