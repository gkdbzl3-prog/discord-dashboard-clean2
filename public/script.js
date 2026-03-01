const params = new URLSearchParams(window.location.search);
window.token = params.get("token");

console.log("token:", window.token);

const qsToken = new URLSearchParams(location.search).get("token");
if (qsToken) localStorage.setItem("adminToken", qsToken);




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

// script.js 내 API 정의 부분
window.API = {
    fetch: async function(path) {
        // path 정의: 전달받은 경로에 인코딩된 토큰을 합칩니다.
        const separator = path.includes('?') ? '&' : '?';
        const fullPath = `${path}${separator}token=${encodeURIComponent(window.token)}`;
        
        console.log("🚀 최종 요청 Path:", fullPath); // 로그로 확인 가능

        const res = await fetch(fullPath);
        if (!res.ok) throw new Error("API error");
        return await res.json();
    }
};


window.currentUserId = null;

// 🔥 앱 시작 시 한 번만 실행
const toastRoot = document.createElement("div");
toastRoot.id = "toast-root";
document.documentElement.appendChild(toastRoot);








window.loadUsers = async function () {
  const data = await window.API.fetch("/today");

  if (!data || typeof data !== "object") {
    console.error("loadUsers: invalid data", data);
    window.usersCache = [];
    return;
  }

  if (Array.isArray(data)) {
    console.error("loadUsers: /today returned ARRAY. 서버 응답 형태가 잘못됨", data);
    window.usersCache = [];
    return;
  }

  window.usersCache = Object.entries(data).map(([id, user]) => ({
    id: String(id),
    name: user?.nickname || user?.usertag || user?.username || String(id),
    avatar: user?.avatar || window.defaultAvatar,
    sessions: Array.isArray(user?.sessions) ? user.sessions : [],
    totalSeconds: user?.totalSeconds || 0,
    online: !!user?.currentStart,
  }));
}

window.loadMyPageUsers = async function () {
  return await window.API.fetch("/mypage");
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

fabMemo.addEventListener("click", () => {
  window.showMemo();
  fabContainer.classList.remove("open");
});

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("heart-btn")) {
    e.target.classList.toggle("liked");
    e.target.classList.add("heart-pop");

    setTimeout(() => {
      e.target.classList.remove("heart-pop");
    }, 300);
  }
});

fabEdit.addEventListener("click", (e) => {
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



});


window.showToast = function(message, type = "success") {

  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2500);
};