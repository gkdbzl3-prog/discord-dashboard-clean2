// manual.js 상단 토큰 설정
if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}
 
console.log("manual loaded");
const users = data.finalUsers || [];
const USER_REGISTRY = [
    { nickname: "날" }, { nickname: "부계 날" }, { nickname: "탐" },
    { nickname: "망난" }, { nickname: "나은" }, { nickname: "하늘" },
    { nickname: "믕" }, { nickname: "말감이" }, { nickname: "y" },
    { nickname: "라해" }, { nickname: "능솨" }, { nickname: "노란동그라밍" },
    { nickname: "담요" }, { nickname: "라오타" }, { nickname: "일영" },
    { nickname: "므엥이" }, { nickname: "꿍냐" }, { nickname: "귤" },
    { nickname: "빙수" }
];



// 1. [공통 함수 정의] - 토스트 알림 등 (가장 먼저 정의)
window.showToast = function (msg, type = "success") {
    const t = document.createElement("div");
    t.className = `fixed bottom-5 right-5 px-6 py-3 rounded-xl text-white z-50 transition-all ${type===`success`?`bg-purple-500`:`bg-red-500`}`;
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// 2. [데이터 로드 함수 정의] - 서버에서 리스트 가져오기
window.fetchAndRenderList = async function () {

  const container = document.getElementById('manualList');
  if (!container) return;

  const res = await fetch(`/manual-data?token=${encodeURIComponent(window.token)}`);
  const data = await res.json();

  const finalUsers = data.finalUsers || [];

  container.innerHTML = finalUsers.map(user => {

    if (!user.sessions) return "";

    return user.sessions
      .filter(s => s.manual)
      .map((s, index) => {

        const mins = Math.floor((s.seconds || 0) / 60);

        return `
          <div class="p-4 bg-white rounded-xl shadow">
            <span>${user.name} - ${mins}분</span>
            <div class="flex gap-2">
              <button onclick="editManualSession('${user.name}', ${index})">✎</button>
              <button onclick="deleteManualSession('${user.name}', ${index})">✕</button>
            </div>
          </div>
        `;

      }).join("");

  }).join("");

};

window.initManual = function () {
  const form = document.getElementById("manualForm");
  if (!form) return;

  const dataList = document.getElementById("userList");
  if (!dataList) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
 const nicknameInput = document.getElementById("userId").value.trim();
  const minutes = document.getElementById("time").value.trim();
            const userFound = USER_REGISTRY.find(user => user.nickname === nicknameInput);

            if (!userFound) return showToast("유저를 선택해주세요!", "error");
try {
    const res = await fetch(`/manual-data?token=${encodeURIComponent(window.token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: nicknameInput,
        minutes
      })
    });

  if (result.success) {
    showToast("저장 완료! ✨");
    document.getElementById('time').value = "";
    fetchAndRenderList();
  }

} catch (e) {
  showToast("저장 실패", "error");
}
        };
    }




window.renderManualList = async function () {
const list = document.getElementById("mypageGrid");  if (!list) return;

  const res = await fetch(`/manual-data?token=${encodeURIComponent(window.token)}`);
  const data = await res.json();

  const sessions = data.sessions || [];

  list.innerHTML = sessions
    .filter(s => s.manual)
    .map((s, index) => {
      const minutes = Math.floor((s.seconds || 0) / 60);
      return `
        <div class="flex justify-between items-center p-3 border-b">
          <span>${s.user} - ${minutes}분</span>
          <div class="flex gap-2">
            <button onclick="window.editManualSession('${s.userId}', ${index})"
              class="text-blue-500 text-sm">수정</button>
            <button onclick="window.deleteManualSession('${s.userId}', ${index})"
              class="text-red-500 text-sm">삭제</button>
          </div>
        </div>
      `;
    })
    .join("");
};

// 4. [메인 실행 함수 정의] - 화면 그리기
window.showManual = async function () {

const result = await res.json();
  const tbody = document.getElementById("manual-tbody");
  const view = document.getElementById("view");
const nicknameInput = document.getElementById("userId").value.trim();
  if (!view) return;
await fetch('/manual-data', {
  method: 'POST',
 body: JSON.stringify({ userId: nicknameInput, minutes })  });

  view.innerHTML = `
                <img src="${user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
    <div class="bg-white p-8 rounded-xl shadow-lg">
      <h2 class="text-2xl font-bold mb-6">나의 기록 추가</h2>

      <form id="manualForm" class="flex gap-3 mb-6">
        <input id="userId" list="userList" placeholder="닉네임" class="border p-2 rounded" />
        <datalist id="userList"></datalist>
        <input id="time" type="number" placeholder="시간(분)" class="border p-2 rounded w-20" />
        <button class="bg-blue-500 text-white px-4 rounded">저장</button>
      </form>

      <div id="manualList"></div>
    </div>
  `;
 const data = await res.json();


const manual = data.manual || []; 
tbody.innerHTML = manual.map(d => `
  <tr>
    <td class="flex items-center gap-2">
      ${d.users.map(u => `
        <img src="${u.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
             class="w-6 h-6 rounded-full"/>
      `).join("")}
      ${d.dayKey}
    </td>
    <td class="text-right">${(d.totalSec/3600).toFixed(1)}h</td>
  </tr>
`).join("");
  initManual();
  renderManualList();
};

// 5. 삭제 함수
window.deleteManualSession = async function(userId, index) {
    if(!confirm("정말 삭제할까요?")) return;
    
    try {
const res = await fetch(`/manual-data?token=${encodeURIComponent(window.token)}`, {
          method: "POST",
    headers: { "Content-Type": "application/json" },
body: JSON.stringify({ userId: nicknameInput, minutes })        });
        

        if (res.ok) {
            showToast("기록이 삭제되었습니다. 🗑️");
            // ⭐️ 페이지 이동(showToday) 코드를 지우고 아래 함수만 호출하세요!
            fetchAndRenderList(); 
        }
    } catch (e) {
        showToast("삭제 실패", "error");
    }
};





window.editManualSession = async function(userId, index) {

  const newMin = prompt("수정할 시간을 입력하세요(분):");
  if (!newMin || isNaN(newMin)) return;

  try {

    const res = await fetch(
      `/edit-session?token=${encodeURIComponent(window.token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          index,
          newSeconds: Number(newMin) * 60
        })
      }
    );

    if (res.ok) {
      showToast(`🕒 ${new Date().toLocaleTimeString()}에 수정 완료!`);
      fetchAndRenderList();
    }

  } catch (error) {
    showToast("수정 실패", "error");
  }

};



