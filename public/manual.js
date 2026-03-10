

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
  window.token =
    window.token ||
    localStorage.getItem("adminToken") ||
    window.ADMIN_TOKEN ||
    "";
  if (window.token) localStorage.setItem("adminToken", window.token);

if (typeof window.stopLiveCounter === "function") window.stopLiveCounter();
  if (window.liveCounter) {
    clearInterval(window.liveCounter);
    window.liveCounter = null;
  }
    // 토큰 체크
    if (!window.token) {
        console.warn("manual modal: token missing, continue without token");
    }

    const preloadPromise = (async () => {
      if (!window.usersCache || Object.keys(window.usersCache).length === 0) {
        if (typeof window.loadUsersLite === "function") {
          await window.loadUsersLite();
        } else {
          await window.loadUsers();
        }
      }
    })();

    let overlay = document.getElementById("modal-overlay");

    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "modal-overlay";
        overlay.className = "modal-overlay";
        document.body.appendChild(overlay);
    }

const getUsers = () => Object.entries(window.usersCache || {})
  .map(([key, u]) => {
    const safe = u || {};
    const id = String(safe.id ?? safe.userId ?? key ?? "");
    const labelRaw = safe.nickname ?? safe.name ?? safe.username ?? id;
    return {
      ...safe,
      id,
      label: String(labelRaw || "Unknown").trim()
    };
  })
  .filter((u) => u.id && u.id !== "users");
    
    overlay.innerHTML = `
        <div class="modal-content">
            <h2 class="modal-title">⏱️ Manual</h2>

            <form id="manualForm" class="manual-form">
                <select id="userSelect" class="modal-input">
                   <option value="" disabled selected hidden>Select user</option>
                </select>

                <div class="number-control">
                    <button type="button" class="num-btn minus">-</button>
                    <input type="number" id="manualMinutes" min="1" value="1" />
                    <button type="button" class="num-btn plus">+</button>
                </div>

                <button type="submit" class="modal-primary-btn">
                   저장
                </button>

                <button type="button" id="loadHistoryBtn" class="modal-secondary-btn">
                    저장기록
                </button>

                <div id="manualHistory" class="modal-history"></div>

                <button type="button" class="modal-close-btn">
                    닫기
                </button>
            </form>
        </div>
    `;

  const manualModalEl = document.getElementById("manualModal"); if (manualModalEl) console.log(manualModalEl.style.display);
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
    const getSessionMinutes = (session) => {
      const sec = Number(session?.seconds);
      if (Number.isFinite(sec) && sec > 0) return Math.floor(sec / 60);

      const startMs = typeof session?.start === "number" ? session.start : Date.parse(session?.start);
      const endMs = typeof session?.end === "number" ? session.end : Date.parse(session?.end);

      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
        return Math.max(0, Math.floor((endMs - startMs) / 60000));
      }
      return 0;
    };

    const userSelect = document.getElementById("userSelect");
    if (userSelect) {
      const renderUserOptions = () => {
        const users = getUsers();
        const prev = userSelect.value;
        userSelect.innerHTML = '<option value="" disabled selected>닉네임</option>';
        userSelect.style.color = "#1a1a1a";
        users.forEach((u) => {
          const option = document.createElement("option");
          option.value = String(u.id ?? "");
          option.textContent = String(u.label || "Unknown");
          userSelect.appendChild(option);
        });
        if (prev) userSelect.value = prev;
      };
      renderUserOptions();
      preloadPromise.then(renderUserOptions).catch(() => {});

      userSelect.addEventListener("change", () => {
        userSelect.style.color = "#1a1a1a";
      });
    }

 document.getElementById("loadHistoryBtn").onclick = async () => {

  const userId = document.getElementById("userSelect").value;
  const historyBox = document.getElementById("manualHistory");

  if (!userId) {
    window.showToast("유저를 먼저 선택해주세요", "error");
    return;
  }
  try {

const data = await window.API.fetch(`/manual-data?userId=${encodeURIComponent(userId)}`);
window.manualDataCache = data;

const user = data.find(u =>
  String(u.id) === String(userId)
);

if (!user) {
  window.showToast("유저를 찾을 수 없습니다", "error");
  return;
}

const sessions = user.sessions || [];
if (sessions.length === 0) {
  historyBox.style.display = "block";
  historyBox.innerHTML = "No manual records";
  return;
}

const itemsHtml = sessions
  .map((session, index) => ({
    session,
    realIndex: Number.isInteger(session?._index) ? session._index : index,
    minutes: getSessionMinutes(session)
  }))
  .filter((x) => x.minutes > 0)
  .map(({ session, realIndex, minutes }) => {
  return `
    <div class="history-item">
      <div>${minutes}분</div>
      <div>
        <button type="button" onclick="window.editManualSession('${userId}', ${realIndex})">수정</button>
        <button type="button" onclick="window.deleteManualSession('${userId}', ${realIndex})">삭제</button>
      </div>
    </div>
  `;
  }).join("");

historyBox.style.display = "block";
historyBox.innerHTML = itemsHtml || "No manual records";
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
                    guildId: window.currentGuildId || localStorage.getItem("guildId") || "",
                    userId, 
                    minutes: Number(minutes) 
                })
            });

            const result = await res.json();
            console.log("📬 Manual 추가 결과:", result);

            if (res.ok && result.ok) {
                window.showToast(result.deduped ? "저장 취소" : "✅ 저장 완료!");
                
                // 유저 캐시 새로고침
                await window.loadUsers();
                window.manualDataCache = null;

                // 히스토리가 이미 열려 있을 때만 갱신
                const historyBox = document.getElementById("manualHistory");
                if (historyBox && historyBox.style.display === "block") {
                  document.getElementById("loadHistoryBtn").click();
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

    // 모달 먼저 열고 데이터는 비동기 로드
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add("show"), 10);

    preloadPromise.catch((err) => {
      console.error("manual preload failed:", err);
    });
};




window.deleteManualSession = async function (userId, index) {

  window.showConfirmModal("정말 삭제할까요?", async () => {

    const res = await fetch("/delete-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: window.token,
        guildId: window.currentGuildId || localStorage.getItem("guildId") || "",
        userId,
        index
      })
    });

    const result = await res.json();

    if (res.ok && result.ok) {

      window.showToast("🗑 삭제 완료");

      await window.loadUsers();
      window.manualDataCache = null;

      const historyBox = document.getElementById("manualHistory");

      if (historyBox && historyBox.style.display === "block") {
        document.getElementById("loadHistoryBtn").click();
      }

    } else {

      window.showToast("삭제 실패", "error");

    }

  });

};



window.editManualSession = function (userId, index) {

  if (!userId) {
    console.error("userId 없음");
    return;
  }

  window.showInputModal("수정할 시간 (분):", async (newMin) => {

    const res = await fetch("/edit-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: window.token,
        guildId: window.currentGuildId || localStorage.getItem("guildId") || "",
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
      window.manualDataCache = null;

      const btn = document.getElementById("loadHistoryBtn");
      if (btn) btn.click();

    } else {

      window.showToast("수정 실패", "error");

    }

  });

};


window.renderDaySessions = function (sessions = [], expanded = false) {
  const visible = expanded ? sessions : sessions.slice(0, 5);

  return `
    <div class="day-session-list">
      ${visible.map(s => `<div class="day-session-item">...</div>`).join("")}
      ${sessions.length > 5 ? `
        <button class="session-toggle-btn" onclick="window.toggleDaySessions()">
          ${expanded ? "접기" : `세션 ${sessions.length - 5}개 더보기`}
        </button>
      ` : ""}
    </div>
  `;
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


window.showConfirmModal = function(message, onConfirm) {

  const overlay = document.createElement("div");
  overlay.className = "app-overlay";

  overlay.innerHTML = `
    <div class="modal-box">

      <div class="modal-title">${message}</div>

      <div class="modal-buttons">
        <button class="btn-cancel">취소</button>
        <button class="btn-confirm">확인</button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  const cancelBtn = overlay.querySelector(".btn-cancel");
  const okBtn = overlay.querySelector(".btn-confirm");

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", escHandler);
  };

  cancelBtn.onclick = close;

  okBtn.onclick = () => {
    onConfirm();
    close();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  const escHandler = (e) => {
    if (e.key === "Escape") close();
  };

  setTimeout(() => {
    document.addEventListener("keydown", escHandler);
  }, 0);

};
