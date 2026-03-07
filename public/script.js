const params = new URLSearchParams(window.location.search);
window.token = params.get("token");

console.log("token:", window.token);

const qsToken = new URLSearchParams(location.search).get("token");
if (qsToken) localStorage.setItem("adminToken", qsToken);


Object.defineProperty(window, "currentUser", {
  set(value) {
    this._currentUser = value;
  },
  get() {
    return this._currentUser;
  }
});

let nicknameFromUrl = params.get("nickname"); // 🔥 통일

if (nicknameFromUrl) {
  localStorage.setItem("nickname", nicknameFromUrl);
}

window.currentNickname = localStorage.getItem("nickname");

if (!window.currentNickname) {
  window.currentNickname = prompt("닉네임을 입력하세요");
  localStorage.setItem("nickname", window.currentNickname);
}

console.log("현재 닉네임:", window.currentNickname);

// 상대 시간 계산 함수
window.formatTimeAgo = function (dateString) {




    if (!dateString) return "기록 없음";
    const diff = new Date() - new Date(dateString);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "오늘";
    if (days < 7) return `${days}일 전`;
    return `${Math.floor(days / 7)}주 전`;
}


window.API = window.API || {};


window.ADMIN_TOKEN = "쪼쪼쪼각할모방";

window.API.fetch = async function (url) {

  const res = await fetch(
    `${url}?token=${window.ADMIN_TOKEN}`
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("API 오류:", text);
    throw new Error("API failed");
  }

  return res.json();
};

window.API.post = async function(url, body) {


  const res = await fetch(`${url}?token=${window.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  return await res.json();
};

window.currentUserId = null;

// 🔥 앱 시작 시 한 번만 실행
const toastRoot = document.createElement("div");
toastRoot.id = "toast-root";
document.documentElement.appendChild(toastRoot);






window.loadUsers = async function () {

  const data = await window.API.fetch("/today");
const DEFAULT_AVATAR =
    "https://cdn.discordapp.com/embed/avatars/0.png";
  const rawUsers = data.users || {};
const EXCLUDED_IDS = [
  "users",
  "146602968860737649" // 🔥 실제 스터디봇 ID
];

const EXCLUDED_NAMES = [
  "스터디봇",
  "users"
];

const list = Object.entries(rawUsers)
  .filter(([id, user]) =>
    !EXCLUDED_IDS.includes(id) &&
    !EXCLUDED_NAMES.includes(user.name)
  )
  .map(([id, user]) => ({
    id,
    name: user.name || "이름없음",
    avatar: user.avatar || DEFAULT_AVATAR,
    sessions: user.sessions || [],
    totalSeconds: user.totalSeconds || 0,
    currentStart: user.currentStart || null
  }));
}



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
      
       
window.toggleTheme = function () {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
};

(function initTheme(){
  const saved = localStorage.getItem("theme");
  document.body.classList.toggle("dark", saved === "dark");
})();

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

window.showMyPage = function (userId) {
  console.log("Go to MyPage:", userId);
  // 나중에 여기서 렌더링
};

window.saveMemoToServer = async function(userId, text) {
  if (!userId || userId === 'undefined') return;
  try {
    // API.fetch가 자동으로 token을 붙여주는지 확인하세요. 
    // 안 붙여준다면 뒤에 &token=${window.token} 을 수동으로 붙여야 합니다.
    await window.API.fetch(`/save-memo?userId=${userId}&memo=${encodeURIComponent(text)}`);
    console.log("메모가 서버에 저장되었습니다.");
  } catch (e) {
    console.error("저장 실패:", e);
  }

await window.API.fetch(
  `/save-memo?memo=${encodeURIComponent(memoText)}`
);

};








// 3. 테마 초기화
(function initTheme(){
    const saved = localStorage.getItem("theme") || "dark";
    document.body.classList.toggle("dark", saved === "dark");
})();

// 4. 메인 이벤트 바인딩 (하나의 DOMContentLoaded로 통합)
document.addEventListener("DOMContentLoaded", async () => {
    const fabContainer = document.querySelector(".fab-container");
    const fabMain = document.getElementById("fabMain");
    const fabMemo = document.getElementById("fabMemo");
    const memoModal = document.getElementById("memoModal");;
    const saveBtn = document.querySelector(".memo-save-btn");
 const fabEdit = document.getElementById("fabEdit");
  const fabOverview = document.getElementById("fabOverview");
const fabMenu = document.getElementById("fab-menu");
    const minInput = document.querySelector("#manualMinutes");
    const minusBtn = document.querySelector(".minus-btn");
    const plusBtn = document.querySelector(".plus-btn");

  window.showToday();


    // FAB 메인 토글
    if (fabMain) {
        fabMain.addEventListener("click", (e) => {
            e.stopPropagation();
            fabContainer.classList.toggle("open");
        });
    }

    // 메모장 열기 (CSS 클래스 'show' 추가 방식으로 수정)
    if (fabMemo) {
        fabMemo.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            
            if (memoModal) {
                // CSS에 있는 .modal-overlay.show 스타일을 활용
                memoModal.style.display = "flex"; 
                setTimeout(() => memoModal.classList.add("show"), 10);
            }
            
            if (window.showMemo) window.showMemo();
            if (fabContainer) fabContainer.classList.remove("open");
        });
    }

    // 전역 클릭 (닫기 로직)
    document.addEventListener("click", (e) => {
        // FAB 닫기
        if (fabContainer && !e.target.closest(".fab-container")) {
            fabContainer.classList.remove("open");
        }
        // 메모장 닫기 (배경 클릭 시)
        if (e.target === memoModal) {
            memoModal.classList.remove("show");
            setTimeout(() => { memoModal.style.display = "none"; }, 200);
        }
    });




   if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            if (window.saveSimpleMemo) window.saveSimpleMemo();
            // 저장 후 닫기 처리
            memoModal.classList.remove("show");
            setTimeout(() => { memoModal.style.display = "none"; }, 200);
        });
    }



    if (minInput && minusBtn && plusBtn) {
        minusBtn.onclick = () => {
            let v = parseInt(minInput.value) || 1;
            if (v > 1) minInput.value = v - 1;
        };
        plusBtn.onclick = () => {
            let v = parseInt(minInput.value) || 1;
            minInput.value = v + 1;
        };
    }



  if (fabMemo) fabMemo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      window.saveSimpleMemo();
    }
  });

if (fabEdit) fabEdit.addEventListener("click", (e) => {
  e.stopPropagation();   // 🔥 핵심
  e.preventDefault();
  window.showManualModal();
});


  if (fabOverview) {
    fabOverview.addEventListener("click", () => {
      window.showTotal("weekly");
      fabMenu.classList.remove("open");
    });
  }

document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("delete-btn")) return;

  const id = e.target.dataset.id;

  await window.API.fetch(`/delete-feed?id=${id}`);


  await window.showToday();

});



document.querySelectorAll(".user-card").forEach(card => {
  card.addEventListener("click", () => {
    const nickname = card.dataset.nickname;
    window.currentNickname = nickname;
    window.showToday();
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const memoInput = document.getElementById("simpleMemo");

  if (memoInput) {
    memoInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        window.saveSimpleMemo();
      }
    });
  }
});

document.getElementById("recordInput")?.setAttribute("spellcheck", "false");
document.getElementById("memo-editor")?.setAttribute("spellcheck", "false");

});


window.showToast = function(message, type = "success") {

  let root = document.getElementById("toast-root");

  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    document.body.appendChild(root);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  root.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2500);
};

window.showInputModal = function (message, onConfirm) {

  const overlay = document.createElement("div");
  overlay.className = "app-overlay";

  overlay.innerHTML = `
    <div class="modal-box">
      <p>${message}</p>
      <input type="number" id="modalInput" min="1" value="1" />
      <div class="modal-buttons">
        <button id="inputCancel">취소</button>
        <button id="inputOk">확인</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = overlay.querySelector("#modalInput");
  const okBtn = overlay.querySelector("#inputOk");
  const cancelBtn = overlay.querySelector("#inputCancel");

  input.focus();
  input.select();

  okBtn.onclick = () => {
    const value = input.value;
    if (!value || value <= 0) {
      window.showToast("올바른 숫자를 입력해주세요", "error");
      return;
    }
    onConfirm(Number(value));
    overlay.remove();
  };

  cancelBtn.onclick = () => {
    overlay.remove();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      okBtn.click();
    }
  });
};