

if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}











// 1. 시간을 h, m으로 변환하는 도우미 함수
window.formatTimeHM = function(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

window.showManualModal = async function() {

stopLiveCounter();
  if (window.liveCounter) {
    clearInterval(window.liveCounter);
    window.liveCounter = null;
  }
    // 토큰 체크
    if (!window.token) {
        window.showToast("토큰이 없습니다", "error");
        return;
    }

    // 유저 목록 로드
    if (!window.usersCache || window.usersCache.length === 0) {
        await window.loadUsers();
    }

    let overlay = document.getElementById("modal-overlay");

    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "modal-overlay";
        overlay.className = "modal-overlay";
        document.body.appendChild(overlay);
    }

const users = Object.values(window.usersCache || {});
    
    overlay.innerHTML = `
        <div class="modal-content">
            <h2 class="modal-title">⏱️ Manual</h2>

            <form id="manualForm" class="manual-form">
                <select id="userSelect" class="modal-input">
                   <option value="" disabled selected hidden>유저 선택 (닉네임)</option>
                    ${users.map(u => `<option value="${u.id}">${u.name}</option>`).join("")}
                </select>
                
                <div class="number-control">
                    <button type="button" class="num-btn minus">−</button>
                    <input type="number" id="manualMinutes" min="1" value="1" />
                    <button type="button" class="num-btn plus">+</button>
                </div>

                <button type="submit" class="modal-primary-btn">
                    저장하기
                </button>

                <button type="button" id="loadHistoryBtn" class="modal-secondary-btn">
                    📜 저장 기록 보기
                </button>

                <div id="manualHistory" class="modal-history"></div>

                <button type="button" class="modal-close-btn">
                    닫기
                </button>
            </form>
        </div>
    `;

  console.log(document.getElementById("manualModal").style.display);
    // ===== 숫자 증감 버튼 =====
    const minusBtn = overlay.querySelector('.num-btn.minus');
    const plusBtn = overlay.querySelector('.num-btn.plus');
    const minutesInput = document.getElementById('manualMinutes');

    minusBtn.onclick = () => {
        const current = parseInt(minutesInput.value) || 1;
        if (current > 1) minutesInput.value = current - 1;
    };

    plusBtn.onclick = () => {
        const current = parseInt(minutesInput.value) || 1;
        minutesInput.value = current + 1;
    };

    // ===== 히스토리 로드 버튼 =====
 document.getElementById("loadHistoryBtn").onclick = async () => {

  const userId = document.getElementById("userSelect").value;

  if (!userId) {
    window.showToast("유저를 먼저 선택해주세요", "error");
    return;
  }

  console.log("📌 히스토리 로드 시작... 유저ID:", userId);

  try {

const data = await window.API.fetch('/manual-data');

const user = data.find(u =>
  String(u.id) === String(userId)
);

if (!user) {
  window.showToast("유저를 찾을 수 없습니다", "error");
  return;
}

const sessions = user.sessions || [];

const historyBox = document.getElementById("manualHistory");
console.log(historyBox.children);
console.log("렌더 직전 sessions:", sessions);
if (sessions.length === 0) {
  historyBox.innerHTML = "저장 기록 없음";
  return;
}
historyBox.style.display = "block";
historyBox.innerHTML = sessions.map((session, index) => {
  const minutes = Math.floor((session.seconds || 0) / 60);

  return `
    <div class="history-item">
      <div>${minutes}분</div>
      <div>
        <button onclick="window.editManualSession('${userId}', ${index})">수정</button>
        <button onclick="window.deleteManualSession('${userId}', ${index})">삭제</button>
      </div>
    </div>
  `;
}).join("");
  } catch (err) {
    console.error("히스토리 로드 실패:", err);
    window.showToast("히스토리를 불러올 수 없습니다", "error");
  }
};

    const submitBtn = overlay.querySelector('button[type="submit"]');
    submitBtn.addEventListener('mouseenter', () => {
        submitBtn.style.background = '#9333ea';
        submitBtn.style.transform = 'translateY(-2px)';
    });
    submitBtn.addEventListener('mouseleave', () => {
        submitBtn.style.background = '#a855f7';
        submitBtn.style.transform = 'translateY(0)';
    });
console.log("clicked history");
    // ===== 폼 제출 =====
    document.getElementById("manualForm").onsubmit = async (e) => {
        e.preventDefault();
        
        const userId = document.getElementById("userSelect").value;
        const minutes = document.getElementById("manualMinutes").value;
        
        if (!userId) {
            window.showToast("유저를 선택해주세요", "error");
            return;
        }

        if (!minutes || minutes <= 0) {
            window.showToast("올바른 시간을 입력해주세요", "error");
            return;
        }

        console.log("📝 Manual 추가 요청:", { userId, minutes });

        try {
            const res = await fetch('/manual-data', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    token: window.token,
                    userId, 
                    minutes: Number(minutes) 
                })
            });

            const result = await res.json();
            console.log("📬 Manual 추가 결과:", result);

            if (res.ok && result.ok) {
                window.showToast("✅ 저장 완료!");
                
                // 유저 캐시 새로고침
                await window.loadUsers();
                
                if (res.ok && result.ok) {
  window.showToast("✅ 저장 완료!");
  await window.loadUsers();

  // 히스토리가 이미 열려 있을 때만 갱신
  const historyBox = document.getElementById("manualHistory");
  if (historyBox.style.display === "block") {
    document.getElementById("loadHistoryBtn").click();
  }
}
            } else {
                window.showToast("❌ 저장 실패: " + (result.error || "알 수 없는 오류"), "error");
            }
        } catch (err) {
            console.error("❌ Manual 추가 실패:", err);
            window.showToast("❌ 저장 실패: " + err.message, "error");
        }
    };

    // ===== 닫기 기능 =====
    const closeManual = () => {
        overlay.classList.remove("show");
        setTimeout(() => { 
            if (!overlay.classList.contains("show")) {
                overlay.style.display = "none";
            }
        }, 200);

startLiveCounter();
    };

    // 닫기 버튼
    const closeBtn = overlay.querySelector(".modal-close-btn");
    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.preventDefault();
            closeManual();
        };

    }


    // 배경 클릭 시 닫기
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeManual();
        }
    };

    // ESC 키로 닫기
    const handleEsc = (e) => {
        if (e.key === "Escape") {
            closeManual();
            document.removeEventListener("keydown", handleEsc);
        }
    };
    document.addEventListener("keydown", handleEsc);

    // 모달 열기
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add("show"), 10);
};








// 삭제 함수
window.deleteManualSession = async function (userId, index) {

  if (!window.showToast("정말 삭제할까요?")) return;

  const res = await fetch("/delete-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: window.token,
      userId,
      index
    })
  });

  const result = await res.json();

if (res.ok && result.ok) {
  window.showToast("🗑 삭제 완료");
  await window.loadUsers();

  const historyBox = document.getElementById("manualHistory");
  if (historyBox.style.display === "block") {
    document.getElementById("loadHistoryBtn").click();
  }

} else {
  window.showToast("삭제 실패", "error");
}

}


window.editManualSession = async function (userId, index) {
if (!userId) {
  console.error("userId 없음");
  return;
}
  const newMin = prompt("수정할 시간 (분):");
  if (!newMin || isNaN(newMin)) return;

  const res = await fetch("/edit-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: window.token,
      userId,
      index,
      newSeconds: Number(newMin) * 60,
      editTime: new Date().toISOString()
    })
  });

  const result = await res.json();

 if (res.ok && result.ok) {
  window.showToast("✏️ 수정 완료!");

  await window.loadUsers();
  document.getElementById("loadHistoryBtn").click();
  } else {
    alert("수정 실패");
  }
};

window.confirmEdit = function(message, onConfirm) {
  const box = document.createElement("div");
  box.className = "toast confirm";
  box.innerHTML = `
    <span>${message}</span>
    <button id="yesBtn">확인</button>
  `;

  document.body.appendChild(box);

  document.getElementById("yesBtn").onclick = () => {
    onConfirm();
    box.remove();
  };
};

window.openMemoModal = function () {
  const memoInput = document.getElementById("simpleMemo");
  memoInput.value = localStorage.getItem("simpleMemo") || "";
  document.getElementById("memoModal").style.display = "flex";
}


