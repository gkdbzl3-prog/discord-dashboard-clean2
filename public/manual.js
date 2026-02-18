// manual.js – 저장 기록 표시, 수정/삭제 포함, 불필요 함수 제거

if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}


console.log("manual loaded");




window.showToast = function (msg, type = "success") {
  const t = document.createElement("div");

  t.className = `fixed bottom-5 right-5 px-6 py-3 rounded-xl text-white z-50 ${
    type === "success" ? "bg-purple-500" : "bg-red-500"
  }`;
  t.innerText = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};

window.showManual = async function () {
  const view = document.getElementById("view");
await window.loadUsers();
const users = window.usersCache;
  view.innerHTML = `
    <div class="bg-white p-6 rounded-xl shadow">
      <h2 class="text-lg font-bold mb-4">Manual 기록</h2>
      <form id="manualForm" class="space-y-3">
<button id="fab">+</button>
        <input id="userId" placeholder="디스코드 ID" class="border p-2 w-full rounded"/>
        <input id="time" type="number" placeholder="분" class="border p-2 w-full rounded"/>
        <button class="bg-indigo-500 text-white px-4 py-2 rounded w-full">저장</button>
      </form>
    </div>
  `;

document.getElementById("fab").onclick = () => {
  window.showManual();
};


  const form = document.getElementById("manualForm");

  form.onsubmit = async function (e) {
    e.preventDefault();

    const userId = document.getElementById("userId").value.trim();
    const minutes = document.getElementById("time").value.trim();

    if (!userId || !minutes) return;

    await fetch(`/manual-data?token=${encodeURIComponent(window.token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, minutes })
    });

    alert("저장 완료");
  };
};


window.editManualSession = async function (userId, index) {
  if (!window.token) return;
  const newMin = prompt("수정할 시간(분):");
  if (newMin == null || newMin === "" || isNaN(Number(newMin))) return;

  try {
    const res = await fetch(`/edit-session?token=${encodeURIComponent(window.token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        index,
        newSeconds: Number(newMin) * 60,
        editTime: new Date().toISOString(),
      }),
    });
    const result = await res.json();

    if (res.ok && result.ok !== false) {
      showToast("수정 완료!");
      window._manualListRefresh?.();
    } else {
      showToast("수정 실패", "error");
    }
  } catch (e) {
    showToast("수정 실패", "error");
  }
 saveData(data);
};

window.deleteManualSession = async function (userId, index) {
  if (!window.token) return;
  if (!confirm("정말 삭제할까요?")) return;

  try {
    const res = await fetch(`/session/delete?token=${encodeURIComponent(window.token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, index }),
    });
    const result = await res.json();

    if (res.ok && result.ok !== false) {
      showToast("기록이 삭제되었습니다. 🗑️");
      window._manualListRefresh?.();
    } else {
      showToast("삭제 실패", "error");
    }
  } catch (e) {
    showToast("삭제 실패", "error");
  }
 saveData(data);
};