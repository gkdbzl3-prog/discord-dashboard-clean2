if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}

window.toOnlineBool = function (value) {
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (!v || v === "false" || v === "0" || v === "null" || v === "undefined" || v === "offline") {
      return false;
    }
    return true;
  }
  return !!value;
};

window.isUserOnline = function (user) {
  if (!user) return false;
  if (user.isOnline !== undefined) return window.toOnlineBool(user.isOnline);
  if (user.online !== undefined) return window.toOnlineBool(user.online);

  const start = user.currentStart;
  if (typeof start === "string") {
    const v = start.trim().toLowerCase();
    if (!v || v === "0" || v === "null" || v === "undefined" || v === "false") return false;
    const n = Number(v);
    return Number.isFinite(n) ? n > 0 : true;
  }
  return !!start;
};

window.getAggregateSessions = function (sessions = []) {
  const list = Array.isArray(sessions) ? sessions : [];
  const hasTagged = list.some((s) => typeof s?.source === "string");
  if (!hasTagged) return list;
  return list.filter((s) => !s?.source || s?.source === "camera_event" || s?.source === "manual" || s?.manual === true);
};

window.applyTodayUsers = function (rawUsers) {
  const usersArray = Array.isArray(rawUsers)
    ? rawUsers
    : Object.values(rawUsers || {});

  window.usersCache = {};

  usersArray.forEach((u) => {
    if (!u || !u.id) return;
    u.isOnline = window.isUserOnline(u);
    u._lastSeenAt = Date.now();
    if (u.isOnline && !Number.isFinite(Number(u.currentStart))) {
      u.currentStart = Date.now();
    }
    window.usersCache[u.id] = u;
  });
};











window.renderDashboard = function() {

  const dashboard = document.getElementById("dashboardSection");
  if (!dashboard) return;

  const users = Object.values(window.usersCache || {})
 .filter(u => u.id !== "users")
 .filter(u => u.id !== "1466022968860737649")
    .sort((a, b) => {
      const aOnline = window.isUserOnline(a);
      const bOnline = window.isUserOnline(b);
      if (aOnline !== bOnline) {
        return Number(bOnline) - Number(aOnline);
      }
      return (b.totalSeconds || 0) - (a.totalSeconds || 0);
    });

  let totalSec = 0;
  users.forEach(u => totalSec += u.totalSeconds || 0);




  const totalText = formatTime(totalSec);

  const activeUsers = users.filter((u) => window.isUserOnline(u));

  const userBlocks = users.map(user => {

    const onlineNow = window.isUserOnline(user);
    const dot = onlineNow
      ? '<span class="online-dot online"></span>'
      : '<span class="online-dot offline"></span>';

    const todaySeconds = getTodaySeconds(user);
    const todayText = formatTime(todaySeconds);
    const totalAllText = formatTime(getLiveTotalSeconds(user));

    const DEFAULT_AVATAR =
      "https://cdn.discordapp.com/embed/avatars/0.png";

    const avatarUrl = user.avatar || DEFAULT_AVATAR;
  
    return `
  <div class="user-card"
       data-id="${user.id}"
       onclick="window.showMyPage('${user.id}')">

    <div class="avatar">
      <img src="${avatarUrl}">
    </div>

    <div class="user-name-row">
      <span class="user-name">
        ${user.nickname || user.name || "이름없음"}
      </span>
      ${dot}
    </div>

    <div class="user-meta">
      오늘 ${todayText}
    </div>

    <div class="user-total">
      <span class="fire ${onlineNow ? "fire-live" : ""}">🔥</span>
      누적 ${totalAllText}
    </div>

  </div>
`;

  }).join("");



const today = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long"
  });

dashboard.innerHTML = `
<div class="dashboard-card">
    <h2>Timeline</h2>

    <div class="timeline-date">
      <div class="date-main">${today}</div>
      <div class="timeline-meta">
        🔥 현재 ${activeUsers.length}명 활동중
      </div>



    
</div>
    <div class="user-grid">
      ${userBlocks}
    </div>

  </div>
`

 
};





window.updateOnlineStatus = function(users) {

  const list = Array.isArray(users) ? users : Object.values(users || {});
  if (!Array.isArray(list) || list.length === 0) return;

  list.forEach(u => {

    const card = document.querySelector(
      `[data-id="${u.id}"]`
    );

    if (!card) return;

    const dot = card.querySelector(".online-dot");
    if (!dot) return;

    const onlineNow = window.isUserOnline(u);
    dot.classList.toggle("online", onlineNow);
    dot.classList.toggle("offline", !onlineNow);
  });
};;

window.getTodaySeconds = function (user) {
  if (!user) return 0;

  const now = Date.now();
  const today = new Date();
  today.setHours(0,0,0,0);

  const rawSessions = Array.isArray(user.sessions) ? user.sessions : [];
  const todaySessions = rawSessions.filter((s) => {
    const st = typeof s?.start === "number" ? s.start : Date.parse(s?.start);
    return Number.isFinite(st) && st >= today.getTime();
  });

  const hasAutoSplitToday = todaySessions.some((s) => s?.source === "auto_split");
  const secondsOf = (s) => {
    const sec = Number(s?.seconds || 0);
    if (Number.isFinite(sec) && sec > 0) return Math.floor(sec);
    const st = typeof s?.start === "number" ? s.start : Date.parse(s?.start);
    const en = typeof s?.end === "number" ? s.end : Date.parse(s?.end);
    if (Number.isFinite(st) && Number.isFinite(en) && en > st) {
      return Math.floor((en - st) / 1000);
    }
    return 0;
  };

  let todaySeconds = todaySessions.reduce((sum, s) => {
    const src = s?.source || (s?.manual === true ? "manual" : "legacy");
    if (src === "camera_event" && hasAutoSplitToday) return sum;
    return sum + secondsOf(s);
  }, 0);

 
  if (user.currentStart && window.isUserOnline(user)) {
    const startTime = Number(user.currentStart);

    if (startTime >= today.getTime()) {
      todaySeconds += Math.floor((now - startTime) / 1000);
    }
  }
  return todaySeconds;
};

window.getLiveTotalSeconds = function (user) {
  if (!user) return 0;
  const rawSessions = Array.isArray(user.sessions) ? user.sessions : [];
  const hasAutoSplit = rawSessions.some((s) => s?.source === "auto_split");
  const secondsOf = (s) => {
    const sec = Number(s?.seconds || 0);
    if (Number.isFinite(sec) && sec > 0) return Math.floor(sec);
    const st = typeof s?.start === "number" ? s.start : Date.parse(s?.start);
    const en = typeof s?.end === "number" ? s.end : Date.parse(s?.end);
    if (Number.isFinite(st) && Number.isFinite(en) && en > st) {
      return Math.floor((en - st) / 1000);
    }
    return 0;
  };

  let total = rawSessions.reduce((sum, s) => {
    const src = s?.source || (s?.manual === true ? "manual" : "legacy");
    if (src === "camera_event" && hasAutoSplit) return sum;
    return sum + secondsOf(s);
  }, 0);
  if (!Number.isFinite(total) || total <= 0) {
    total = Number(user.totalSeconds || 0);
  }
  if (!Number.isFinite(total) || total < 0) total = 0;

  if (window.isUserOnline(user)) {
    const start = Number(user.currentStart);
    if (Number.isFinite(start) && start > 0) {
      total += Math.max(0, Math.floor((Date.now() - start) / 1000));
    }
  }
  return total;
};


window.startDashboardInterval = function () {

  if (window.dashboardInterval) return;

  window.dashboardInterval = setInterval(async () => {
    try {
      const rawData = await window.API.fetch("/today");
      window.todayCache = rawData;
      window.todaySettings = rawData.settings || {};
      window.applyTodayUsers(rawData.users);
      window.renderDashboard();
      window.updateOnlineStatus(rawData.users);
    } catch (err) {
      console.error("dashboard polling failed:", err);
    }

  }, 5000);

  window.startDashboardSmoothTicker();
};

window.startDashboardSmoothTicker = function () {
  if (window.dashboardSmoothInterval) return;

  window.dashboardSmoothInterval = setInterval(() => {
    const dashboard = document.getElementById("dashboardSection");
    if (!dashboard || dashboard.classList.contains("hidden")) return;
    if (!window.usersCache || Object.keys(window.usersCache).length === 0) return;

    window.updateDashboardLiveCounters();
  }, 1000);
};

window.getSettlementWeekKey = function (date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const daysBack = (d.getDay() + 2) % 7;
  d.setDate(d.getDate() - daysBack);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

window.shiftSettlementWeekKey = function (weekKey, delta) {
  const [y, m, d] = String(weekKey || "").split("-").map(Number);
  const base = new Date(y, (m || 1) - 1, d || 1);
  base.setDate(base.getDate() + (delta * 7));
  return window.getSettlementWeekKey(base);
};

window.formatSettlementWeekLabel = function (weekKey) {
  const [y, m, d] = String(weekKey || "").split("-").map(Number);
  const friday = new Date(y, (m || 1) - 1, d || 1);
  const thursday = new Date(friday);
  thursday.setDate(friday.getDate() + 6);
  const fmt = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
  return `${friday.getFullYear()}년 ${fmt(friday)} ~ ${fmt(thursday)}`;
};

window.normalizeSettlementBoard = function (rawBoard) {
  const board = rawBoard && typeof rawBoard === "object" ? rawBoard : {};
  const members = Array.isArray(board.members)
    ? [...new Set(board.members.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];
  const weeks = {};

  if (board.weeks && typeof board.weeks === "object" && !Array.isArray(board.weeks)) {
    Object.entries(board.weeks).forEach(([weekKey, weekMap]) => {
      const safeWeekKey = String(weekKey || "").trim();
      if (!safeWeekKey) return;
      if (!weekMap || typeof weekMap !== "object" || Array.isArray(weekMap)) return;

      const nextMap = {};
      Object.entries(weekMap).forEach(([userId, status]) => {
        const safeUserId = String(userId || "").trim();
        const safeStatus = String(status || "").trim();
        if (!safeUserId) return;
        if (!["done", "miss", ""].includes(safeStatus)) return;
        nextMap[safeUserId] = safeStatus;
      });

      weeks[safeWeekKey] = nextMap;
    });
  }

  return { members, weeks };
};

window.computeSettlementMap = function (board, currentWeekKey) {
  const normalized = window.normalizeSettlementBoard(board);
  const keys = Object.keys(normalized.weeks || {});
  if (currentWeekKey) keys.push(currentWeekKey);
  const orderedKeys = [...new Set(keys)].sort();
  const statsMap = {};
  let carry = 0;

  orderedKeys.forEach((weekKey) => {
    const weekMap = normalized.weeks?.[weekKey] || {};
    const values = Object.values(weekMap);
    const doneCount = values.filter((v) => v === "done").length;
    const missCount = values.filter((v) => v === "miss").length;
    const finePool = missCount * 1000;
    const rewardPool = carry + finePool;
    const perWinnerSaving = doneCount > 0 ? Math.floor(rewardPool / doneCount) : 0;
    const carryOut = doneCount > 0 ? rewardPool % doneCount : rewardPool;
    const perWinnerTotal = doneCount > 0 ? 2000 + perWinnerSaving : 0;

    statsMap[weekKey] = {
      weekKey,
      doneCount,
      missCount,
      finePool,
      carryIn: carry,
      rewardPool,
      perWinnerSaving,
      perWinnerTotal,
      carryOut
    };

    carry = carryOut;
  });

  return statsMap;
};

window.saveSettlementBoard = async function () {
  const payload = window.normalizeSettlementBoard(window.settlementBoard || {});
  const res = await window.API.post("/save-settlement-board", {
    settlementBoard: payload
  });
  window.todaySettings = window.todaySettings || {};
  window.todaySettings.settlementBoard = window.normalizeSettlementBoard(res?.settlementBoard || payload);
  window.settlementBoard = window.todaySettings.settlementBoard;
};

window.addSettlementMember = async function () {
  const select = document.getElementById("settlementMemberSelect");
  if (!select || !select.value) return;
  const board = window.normalizeSettlementBoard(window.settlementBoard || {});
  if (!board.members.includes(select.value)) {
    board.members.push(select.value);
  }
  window.settlementBoard = board;
  await window.saveSettlementBoard();
  window.renderSettlementBoard();
};

window.removeSettlementMember = async function (userId) {
  const board = window.normalizeSettlementBoard(window.settlementBoard || {});
  board.members = board.members.filter((id) => id !== userId);
  window.settlementBoard = board;
  await window.saveSettlementBoard();
  window.renderSettlementBoard();
};

window.setSettlementStatus = async function (userId, status) {
  const board = window.normalizeSettlementBoard(window.settlementBoard || {});
  const weekKey = window.currentSettlementWeekKey || window.getSettlementWeekKey();
  board.weeks[weekKey] = board.weeks[weekKey] || {};
  board.weeks[weekKey][userId] = status;
  window.settlementBoard = board;
  await window.saveSettlementBoard();
  window.renderSettlementBoard();
};

window.renderSettlementBoard = function (boardRaw = window.todaySettings?.settlementBoard) {
  const section = document.getElementById("settlementBoardSection");
  if (!section) return;

  const board = window.normalizeSettlementBoard(boardRaw);
  window.settlementBoard = board;
  if (!window.currentSettlementWeekKey) {
    window.currentSettlementWeekKey = window.getSettlementWeekKey();
  }

  const weekKey = window.currentSettlementWeekKey;
  const statsMap = window.computeSettlementMap(board, weekKey);
  const stats = statsMap[weekKey] || {
    doneCount: 0,
    missCount: 0,
    finePool: 0,
    carryIn: 0,
    rewardPool: 0,
    perWinnerSaving: 0,
    perWinnerTotal: 0,
    carryOut: 0
  };

  const weekMap = board.weeks?.[weekKey] || {};
  const users = Object.values(window.usersCache || {})
    .filter((u) => !!u && !!u.id && u.id !== "1466022968860737649")
    .sort((a, b) => String(a.nickname || a.name || "").localeCompare(String(b.nickname || b.name || ""), "ko"));

  const members = board.members
    .map((id) => users.find((user) => user.id === id) || { id, nickname: id, avatar: null })
    .filter(Boolean);

  const availableUsers = users.filter((user) => !board.members.includes(user.id));
  const rowsHtml = members.map((user) => {
    const status = String(weekMap[user.id] || "");
    const doneActive = status === "done" ? "active" : "";
    const missActive = status === "miss" ? "active" : "";
    const unsetActive = !status ? "active" : "";
    let resultHtml = `<span class="settlement-result neutral">입력 대기</span>`;

    if (status === "done") {
      resultHtml = `
        <span class="settlement-result good">상금 +2,000</span>
        <span class="settlement-result good">적립금 +${stats.perWinnerSaving.toLocaleString()}</span>
        <span class="settlement-result total">총 +${stats.perWinnerTotal.toLocaleString()}</span>
      `;
    } else if (status === "miss") {
      resultHtml = `<span class="settlement-result bad">벌금 -1,000</span>`;
    }

    const avatar = user.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";
    const name = user.nickname || user.name || user.id;
    return `
      <div class="settlement-member-row">
        <div class="settlement-member-main">
          <div class="settlement-member-profile">
            <img src="${avatar}" alt="${name}">
            <div>
              <div class="settlement-member-name">${name}</div>
              <div class="settlement-member-sub">${status === "done" ? "목표 달성" : status === "miss" ? "목표 미달" : "아직 미입력"}</div>
            </div>
          </div>
          <button class="settlement-remove-btn" onclick="window.removeSettlementMember('${user.id}')">삭제</button>
        </div>
        <div class="settlement-toggle-group">
          <button class="settlement-toggle ${doneActive}" onclick="window.setSettlementStatus('${user.id}','done')">달성</button>
          <button class="settlement-toggle miss ${missActive}" onclick="window.setSettlementStatus('${user.id}','miss')">미달</button>
          <button class="settlement-toggle muted ${unsetActive}" onclick="window.setSettlementStatus('${user.id}','')">미입력</button>
        </div>
        <div class="settlement-result-row">
          ${resultHtml}
        </div>
      </div>
    `;
  }).join("");

  const optionHtml = availableUsers.map((user) => {
    const name = user.nickname || user.name || user.id;
    return `<option value="${user.id}">${name}</option>`;
  }).join("");

  section.innerHTML = `
    <div class="settlement-card">
      <div class="settlement-header">
        <div>
          <div class="settlement-eyebrow">Weekly Settlement</div>
          <h2 class="settlement-title">주간 정산 보드</h2>
          <p class="settlement-note">일주일(금~목)마다 목표시간에 달성 시 상금(2000원)+적립금(+n)을 드리며,미달성 시 벌금을 부여하고 있습니다.</p>
        </div>
        <div class="settlement-week-nav">
          <button onclick="window.currentSettlementWeekKey = window.shiftSettlementWeekKey(window.currentSettlementWeekKey || window.getSettlementWeekKey(), -1); window.renderSettlementBoard();">◀</button>
          <div class="settlement-week-label">${window.formatSettlementWeekLabel(weekKey)}</div>
          <button onclick="window.currentSettlementWeekKey = window.shiftSettlementWeekKey(window.currentSettlementWeekKey || window.getSettlementWeekKey(), 1); window.renderSettlementBoard();">▶</button>
        </div>
      </div>

      <div class="settlement-summary-grid">
        <div class="settlement-summary-card">
          <span class="settlement-summary-label">달성 인원</span>
          <strong class="settlement-summary-value">${stats.doneCount}명</strong>
        </div>
        <div class="settlement-summary-card">
          <span class="settlement-summary-label">벌금 총액</span>
          <strong class="settlement-summary-value">${stats.finePool.toLocaleString()}원</strong>
        </div>
        <div class="settlement-summary-card">
          <span class="settlement-summary-label">이월 포함 풀</span>
          <strong class="settlement-summary-value">${stats.rewardPool.toLocaleString()}원</strong>
        </div>
        <div class="settlement-summary-card">
          <span class="settlement-summary-label">1인당 총 지급</span>
          <strong class="settlement-summary-value">${stats.perWinnerTotal.toLocaleString()}원</strong>
        </div>
      </div>

      <div class="settlement-carry-box">
        <span>이전 주 이월 ${stats.carryIn.toLocaleString()}원</span>
        <span>다음 주 이월 ${stats.carryOut.toLocaleString()}원</span>
      </div>

      <div class="settlement-add-row">
        <select id="settlementMemberSelect" class="settlement-member-select">
          <option value="">정산 멤버 추가</option>
          ${optionHtml}
        </select>
        <button class="settlement-add-btn" onclick="window.addSettlementMember()">추가</button>
      </div>

      <div class="settlement-member-list">
        ${rowsHtml || `<div class="settlement-empty">정산 보드에 멤버를 추가해줘.</div>`}
      </div>
    </div>
  `;
};

window.updateDashboardLiveCounters = function () {
  const users = Object.values(window.usersCache || {})
    .filter((u) => u && u.id)
    .filter((u) => u.id !== "users")
    .filter((u) => u.id !== "1466022968860737649");

  users.forEach((user) => {
    const card = document.querySelector(`.user-card[data-id="${user.id}"]`);
    if (!card) return;

    const todayText = formatTime(getTodaySeconds(user));
    const totalAllText = formatTime(getLiveTotalSeconds(user));

    const meta = card.querySelector(".user-meta");
    if (meta) meta.textContent = `오늘 ${todayText}`;

    const total = card.querySelector(".user-total");
    if (total) {
      total.innerHTML = `
        <span class="fire ${window.isUserOnline(user) ? "fire-live" : ""}">🔥</span>
        누적 ${totalAllText}
      `;
    }
  });

  const activeUsers = users.filter((u) => window.isUserOnline(u)).length;
  const timelineMeta = document.querySelector(".timeline-meta");
  if (timelineMeta) {
    timelineMeta.textContent = `🔥 현재 ${activeUsers}명 활동중`;
  }
};


window.showOverview = function () {
  const dashboard = document.getElementById("dashboardSection");

  if (dashboard) {
    dashboard.style.display = "none";
  }
document.getElementById("dashboardSection")?.classList.add("hidden");

}


window.showTimeline = function () {
  const dashboard = document.getElementById("dashboardSection");

  if (dashboard) {
    dashboard.style.display = "block";
  }
document.getElementById("dashboardSection")?.classList.remove("hidden");
}

window.formatTime = function (seconds) {

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 ${secs}초`;
  }

  if (minutes > 0) {
    return `${minutes}분 ${secs}초`;
  }

  return `${secs}초`;
}







window.updateOnlineStatus = function(users){
  const list = Array.isArray(users) ? users : Object.values(users || {});
  list.forEach((user) => {
    const card = document.querySelector(`[data-id="${user?.id}"]`);
    if (!card) return;
    const dot = card.querySelector(".online-dot");
    if (!dot) return;
    const onlineNow = window.isUserOnline(user);
    dot.classList.toggle("online", onlineNow);
    dot.classList.toggle("offline", !onlineNow);
  });
};

window.imageZoomState = {
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  startX: 0,
  startY: 0,
  lastTouchDistance: null
};

window.applyImageTransform = function () {
  const img = document.getElementById("imageModalImg");
  if (!img) return;

  const { scale, x, y } = window.imageZoomState;
  img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
};

window.resetImageZoom = function () {
  window.imageZoomState = {
    scale: 1,
    x: 0,
    y: 0,
    dragging: false,
    startX: 0,
    startY: 0,
    lastTouchDistance: null
  };
  window.applyImageTransform();
};

window.openImageModal = function (src) {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("imageModalImg");
  if (!modal || !img) return;

  img.src = src;
  modal.classList.add("show");
  window.resetImageZoom();
};

window.closeImageModal = function () {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("imageModalImg");
  if (!modal || !img) return;

  modal.classList.remove("show");
  img.src = "";
  window.resetImageZoom();
};

window.getTouchDistance = function (touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

// 피드 이미지 클릭 시 열기
document.addEventListener("click", (e) => {
  const modal = document.getElementById("imageModal");
  const closeBtn = document.getElementById("imageModalClose");

  if (e.target.classList.contains("feed-image")) {
    window.openImageModal(e.target.src);
    return;
  }

  if (e.target === modal || e.target === closeBtn) {
    window.closeImageModal();
  }
});

// ESC 닫기
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.closeImageModal();
  }
});

// 마우스 휠 줌
document.addEventListener("wheel", (e) => {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("imageModalImg");
  if (!modal?.classList.contains("show") || !img) return;
  if (e.target !== img) return;

  e.preventDefault();

  const state = window.imageZoomState;
  const delta = e.deltaY < 0 ? 0.12 : -0.12;
  state.scale = Math.min(4, Math.max(1, state.scale + delta));

  if (state.scale === 1) {
    state.x = 0;
    state.y = 0;
  }

  window.applyImageTransform();
}, { passive: false });

// 마우스 드래그 시작
document.addEventListener("mousedown", (e) => {
  const img = document.getElementById("imageModalImg");
  if (!img) return;
  if (e.target !== img) return;
  if (window.imageZoomState.scale <= 1) return;

  const state = window.imageZoomState;
  state.dragging = true;
  state.startX = e.clientX - state.x;
  state.startY = e.clientY - state.y;
  img.classList.add("dragging");
});

// 마우스 드래그 이동
document.addEventListener("mousemove", (e) => {
  const state = window.imageZoomState;
  if (!state.dragging) return;

  state.x = e.clientX - state.startX;
  state.y = e.clientY - state.startY;
  window.applyImageTransform();
});

// 마우스 드래그 종료
document.addEventListener("mouseup", () => {
  const img = document.getElementById("imageModalImg");
  window.imageZoomState.dragging = false;
  img?.classList.remove("dragging");
});

// 터치 시작
document.addEventListener("touchstart", (e) => {
  const img = document.getElementById("imageModalImg");
  const modal = document.getElementById("imageModal");
  if (!modal?.classList.contains("show") || !img) return;
  if (e.target !== img) return;

  const state = window.imageZoomState;

  if (e.touches.length === 2) {
    state.lastTouchDistance = window.getTouchDistance(e.touches);
  }

  if (e.touches.length === 1 && state.scale > 1) {
    state.dragging = true;
    state.startX = e.touches[0].clientX - state.x;
    state.startY = e.touches[0].clientY - state.y;
  }
}, { passive: false });

// 터치 이동: 핀치 줌 + 드래그
document.addEventListener("touchmove", (e) => {
  const img = document.getElementById("imageModalImg");
  const modal = document.getElementById("imageModal");
  if (!modal?.classList.contains("show") || !img) return;
  if (e.target !== img) return;

  const state = window.imageZoomState;

  // 핀치 줌
  if (e.touches.length === 2) {
    e.preventDefault();

    const distance = window.getTouchDistance(e.touches);

    if (state.lastTouchDistance) {
      const diff = (distance - state.lastTouchDistance) / 180;
      state.scale = Math.min(4, Math.max(1, state.scale + diff));

      if (state.scale === 1) {
        state.x = 0;
        state.y = 0;
      }

      window.applyImageTransform();
    }

    state.lastTouchDistance = distance;
    return;
  }

  // 한 손 드래그
  if (e.touches.length === 1 && state.dragging && state.scale > 1) {
    e.preventDefault();

    state.x = e.touches[0].clientX - state.startX;
    state.y = e.touches[0].clientY - state.startY;
    window.applyImageTransform();
  }
}, { passive: false });

// 터치 끝
document.addEventListener("touchend", () => {
  window.imageZoomState.dragging = false;
  window.imageZoomState.lastTouchDistance = null;
});

window.applyImageTransform = function () {
  const img = document.getElementById("imageModalImg");
  if (!img) return;

  const { scale, x, y } = window.imageZoomState;
  img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
};

window.resetImageZoom = function () {
  window.imageZoomState = {
    scale: 1,
    x: 0,
    y: 0,
    dragging: false,
    startX: 0,
    startY: 0,
    lastTouchDistance: null
  };
  window.applyImageTransform();
};

window.openImageModal = function (src) {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("imageModalImg");
  if (!modal || !img) return;

  img.src = src;
  modal.classList.add("show");
  window.resetImageZoom();
};

window.closeImageModal = function () {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("imageModalImg");
  if (!modal || !img) return;

  modal.classList.remove("show");
  img.src = "";
  window.resetImageZoom();
};

document.addEventListener("click", (e) => {
  const modal = document.getElementById("imageModal");
  const closeBtn = document.getElementById("imageModalClose");

  if (e.target.classList.contains("feed-image")) {
    window.openImageModal(e.target.src);
  }

  if (e.target === modal || e.target === closeBtn) {
    window.closeImageModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.closeImageModal();
  }
});

document.addEventListener("wheel", (e) => {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("imageModalImg");
  if (!modal?.classList.contains("show") || !img) return;
  if (e.target !== img) return;

  e.preventDefault();

  const state = window.imageZoomState;
  const delta = e.deltaY < 0 ? 0.12 : -0.12;
  state.scale = Math.min(4, Math.max(1, state.scale + delta));

  if (state.scale === 1) {
    state.x = 0;
    state.y = 0;
  }

  window.applyImageTransform();
}, { passive: false });

document.addEventListener("mousedown", (e) => {
  const img = document.getElementById("imageModalImg");
  if (!img) return;
  if (e.target !== img) return;
  if (window.imageZoomState.scale <= 1) return;

  const state = window.imageZoomState;
  state.dragging = true;
  state.startX = e.clientX - state.x;
  state.startY = e.clientY - state.y;
  img.classList.add("dragging");
});

document.addEventListener("mousemove", (e) => {
  const state = window.imageZoomState;
  if (!state.dragging) return;

  state.x = e.clientX - state.startX;
  state.y = e.clientY - state.startY;
  window.applyImageTransform();
});

document.addEventListener("mouseup", () => {
  const img = document.getElementById("imageModalImg");
  window.imageZoomState.dragging = false;
  img?.classList.remove("dragging");
});

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

document.addEventListener("touchstart", (e) => {
  const img = document.getElementById("imageModalImg");
  if (!img) return;
  if (e.target !== img) return;

  if (e.touches.length === 2) {
    window.imageZoomState.lastTouchDistance = getTouchDistance(e.touches);
  }

  if (e.touches.length === 1 && window.imageZoomState.scale > 1) {
    const state = window.imageZoomState;
    state.dragging = true;
    state.startX = e.touches[0].clientX - state.x;
    state.startY = e.touches[0].clientY - state.y;
  }
}, { passive: false });

document.addEventListener("touchmove", (e) => {
  const img = document.getElementById("imageModalImg");
  const modal = document.getElementById("imageModal");
  if (!modal?.classList.contains("show") || !img) return;
  if (e.target !== img) return;

  const state = window.imageZoomState;

  if (e.touches.length === 2) {
    e.preventDefault();

    const distance = getTouchDistance(e.touches);
    if (state.lastTouchDistance) {
      const diff = (distance - state.lastTouchDistance) / 200;
      state.scale = Math.min(4, Math.max(1, state.scale + diff));
      if (state.scale === 1) {
        state.x = 0;
        state.y = 0;
      }
      window.applyImageTransform();
    }
    state.lastTouchDistance = distance;
  }

  if (e.touches.length === 1 && state.dragging && state.scale > 1) {
    e.preventDefault();
    state.x = e.touches[0].clientX - state.startX;
    state.y = e.touches[0].clientY - state.startY;
    window.applyImageTransform();
  }
}, { passive: false });

document.addEventListener("touchend", () => {
  window.imageZoomState.dragging = false;
  window.imageZoomState.lastTouchDistance = null;
});

window.renderFeed = function(feed) {

  const container = document.querySelector(".feed-container");
  if (!container) return;

  if (!feed || feed.length === 0) {
    container.innerHTML =
      "<p style='opacity:0.6'>아직 활동 기록이 없어요</p>";
    return;
  }

  const DEFAULT_AVATAR =
    "https://cdn.discordapp.com/embed/avatars/0.png";

  const html = feed.map(item => {
const imageHtml = item.image
  ? `<img class="feed-image" src="${item.image}" alt="memo image">`
  : "";

  if (!item || typeof item !== "object") return "";

  const user = window.usersCache[String(item.userId)] || {
    id: String(item.userId || ""),
    nickname: item.nickname || "이름없음",
    name: item.nickname || "이름없음",
    avatar: DEFAULT_AVATAR,
    totalSeconds: 0,
    sessions: [],
    feedCount: 0
  };

    const rawName = user.nickname || item.nickname || "이름없음";
    const nickname = String(rawName || "")
      .replace(/^undefined$/i, "")
      .trim() || "이름없음";

const avatarUrl =
  user?.avatar?.startsWith("http")
    ? user.avatar
    : DEFAULT_AVATAR;

 const isMine =
  String(item.userId) === String(window.currentUserId);

    const timeText =
      item.createdAt ? formatFeedTime(item.createdAt) : "";

    const actorKey = String(window.currentUserId || window.currentNickname || "");
    const likedBy = Array.isArray(item.likedBy) ? item.likedBy.map(String) : [];
    const isLiked = actorKey ? likedBy.includes(actorKey) : !!item.liked;
    const likeCount = Number.isFinite(Number(item.likes))
      ? Number(item.likes)
      : likedBy.length;

    const level =
      getUserLevel(user.totalSeconds || 0);
const safeText = String(item.text ?? item.memo ?? "")
  .replace(/\bundefined\b/gi, "")
  .trim();

const bioText = `
 ${level.label}<br>
누적 ${formatTime(user.totalSeconds || 0)}<br>
참여 ${Array.isArray(user.sessions) ? user.sessions.length : 0}<br>
피드 ${user.feedCount || 0}
`;


    return `
 

  <div class="feed-item ${isMine ? "mine" : ""}">

      <div class="feed-left">
        <div class="feed-avatar">
          <img src="${avatarUrl}"
               onclick="window.showMyPage('${item.userId}')">
        </div>

        <div class="feed-main">
          <div class="feed-name-wrapper">
            <span class="feed-name">${nickname}</span>
            <div class="profile-tooltip ${level.className}">
              ${bioText}
            </div>
          </div>

          <div class="feed-text">${safeText || "(내용 없음)"}</div>
 ${imageHtml}
        </div>
      </div>

      <div class="feed-right">
        <span class="feed-time">${timeText}</span>

        <button 
          class="feed-like ${isLiked ? "liked" : ""}" 
          data-id="${item.id}">
          <span class="heart-icon">
            ${isLiked ? "❤️" : "🤍"}
          </span>
          <span class="like-count">${likeCount}</span>
        </button>
${isMine ? `<span class="delete-btn" data-id="${item.id}">×</span>` : ""}

      </div>
    </div>

    <div class="feed-divider"></div>
  `;

}).join("");

  
container.innerHTML = html;

 container.addEventListener("click", function(e){

  if (e.target.classList.contains("delete-btn")) {

    e.stopPropagation();

    const id = e.target.dataset.id;

    window.deleteFeedItem(id);

  }

if (e.target.closest(".feed-like")) {

  const btn = e.target.closest(".feed-like");
  const id = btn.dataset.id;

  window.toggleFeedLike(id);

}


  const likeBtn = e.target.closest(".feed-like");

  if(likeBtn){

    const id = likeBtn.dataset.id;

    window.toggleFeedLike(id);

  }



});
const fileInput = document.getElementById("fabMemoImage");
const preview = document.getElementById("memoPreview");
const fileNameEl = document.getElementById("memoFileName");

if (fileInput && preview) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) {
      preview.removeAttribute("src");
      preview.style.display = "none";
      if (fileNameEl) fileNameEl.textContent = "선택된 파일 없음";
      return;
    }

    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
    if (fileNameEl) fileNameEl.textContent = file.name || "선택된 파일 없음";
  });
}

}

window.createFeed = async function (text) {
  const nickname =
    window.currentNickname ||
    localStorage.getItem("nickname") ||
    "unknown";

  const imageInput = document.getElementById("fabMemoImage");
  const imageFile = imageInput?.files?.[0];

  if (!text?.trim() && !imageFile) return;

  const formData = new FormData();
  formData.append("userId", window.currentUserId || "");
  formData.append("nickname", nickname);
  formData.append("memo", text || "");

  if (imageFile) {
    formData.append("image", imageFile);
  }

  const token = window.token || localStorage.getItem("adminToken") || "";
  const guildId = window.currentGuildId || localStorage.getItem("guildId") || "";
  let url = `/save-feed${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  if (guildId) {
    url += `${url.includes("?") ? "&" : "?"}guildId=${encodeURIComponent(guildId)}`;
  }

  const res = await fetch(url, {
    method: "POST",
    body: formData
  });

  const responseText = await res.text();
  let result = {};
  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch (e) {
    console.error("피드 저장 실패(응답 파싱):", responseText);
    return;
  }

  if (!res.ok || !result.ok) {
    console.error("피드 저장 실패:", res.status, result);
    return;
  }

  if (imageInput) imageInput.value = "";

  window.loadFeed();
};

window.openImageModal = function(src) {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("imageModalImg");
  if (!modal || !img) return;

  img.src = src;
  modal.classList.add("show");
};

window.closeImageModal = function() {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("imageModalImg");
  if (!modal || !img) return;

  modal.classList.remove("show");
  img.src = "";
};

document.addEventListener("click", (e) => {
  const modal = document.getElementById("imageModal");
  const closeBtn = document.getElementById("imageModalClose");

  if (e.target.classList.contains("feed-image")) {
    window.openImageModal(e.target.src);
  }

  if (e.target === modal || e.target === closeBtn) {
    window.closeImageModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.closeImageModal();
  }
});

window.loadFeed = async function(){
  const data = await window.API.fetch("/today");
  window.renderFeed(data.feed);

};

window.feedStudyStart = function(name){

  window.createFeed(`🔥 ${name} 공부 시작`);

};

window.feedStudyEnd = function(name,time){

  window.createFeed(`⏸ ${name} 공부 종료 (${time})`);

};

window.getUserLevel = function (totalSeconds = 0) {
  const HOUR = 3600;

  if (totalSeconds >= 50 * HOUR) {
    return { label: "👾공부몬스터", className: "level-monster" };
  }

  if (totalSeconds >= 15 * HOUR) {
    return { label: "🔥초집중러", className: "level-focus" };
  }

  if (totalSeconds >= 3 * HOUR) {
    return { label: "🤓출석왕", className: "level-king" };
  }

  return { label: "🌱새싹", className: "level-sprout" };
}


window.formatFeedTime = function (timestamp) {

  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;

  const date = new Date(timestamp);
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}


window.toggleFeedLike = async function(feedId){

  try{

    const actor = window.currentNickname || localStorage.getItem("nickname") || "anonymous";
    const res = await window.API.post("/feed-like", { feedId: Number(feedId), nickname: actor });
    const likes = Number(res?.likes || 0);
    const liked = !!res?.liked;

    const btn = document.querySelector(`.feed-like[data-id="${feedId}"]`);
    if(!btn) return;

    const icon = btn.querySelector(".heart-icon");
    const count = btn.querySelector(".like-count");

    btn.classList.toggle("liked", liked);

    icon.textContent = liked ? "❤️" : "🤍";

    count.textContent = likes;

  }catch(err){
    console.error(err);
  }

};


window.openProfileModal = function(userId) {
  console.log("?꾨줈??紐⑤떖 ?닿린:", userId);
};

// ?곷? ?쒓컙??怨꾩궛?섎뒗 ?꾩슦誘??⑥닔
window.getTimeAgo = function (dateString) {


   // ?곷? ?쒓컙 怨꾩궛 (dateString???놁쓣 ?뚯쓽 ?먮윭 諛⑹뼱)
    if (!dateString || dateString === "undefined") return "최근 활동"; 
    const now = new Date();
    const past = new Date(dateString);
    if (isNaN(past.getTime())) return "최근 활동";

    const diffInMs = now - past;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "오늘";
    if (diffInDays < 7) return `${diffInDays}일 전`;
    return `${Math.floor(diffInDays / 7)}주 전`;
}




window.showToday = async function() {
  document.body.classList.remove("mypage");

  window.renderSkeletonUI();

  const rawData = await window.API.fetch("/today");

  window.todayCache = rawData;
  window.todaySettings = rawData.settings || {};

  window.applyTodayUsers(rawData.users);

  window.renderTodayLayout();   // ?뵦 癒쇱? 援ъ“ ?앹꽦
  window.renderDashboard();     // ?뵦 洹??ㅼ쓬 ?곗씠???뚮뜑
  window.renderSettlementBoard(window.todaySettings.settlementBoard);
  window.renderFeed(rawData.feed);

  window.startDashboardInterval();
};

window.renderTodayLayout = function() {

  const view = document.getElementById("view");

  view.innerHTML = `

      <div id="dashboardSection" class="dashboard-grid"></div>

      <div id="settlementBoardSection"></div>

      <div id="feedSection" class="feed-card">
        <h2>Activity Feed</h2>
        <div class="feed-container"></div>
      </div>

  `;
};

window.loadTodayData = async function () {
 const data = await window.API.fetch("/today");
 window.applyTodayUsers(data.users);
 return data;
}

window.renderSkeletonUI = function () {
  const view = document.getElementById("view");
  if (!view) return;

  view.innerHTML = `
    <div class="dashboard-card">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-block"></div>
    </div>

    <div class="feed-card">
      <div class="skeleton skeleton-block"></div>
      <div class="skeleton skeleton-block"></div>
    </div>
  `;
};


window.initDashboard = async function () {
  const users = Object.values(window.usersCache || {});
  window.renderDashboard(users);
}

initDashboard();

window.attachUserCardEvents = function () {
 document.querySelectorAll(".user-card").forEach(card => {
    card.addEventListener("click", () => {
      const nickname = card.dataset.nickname;
      window.currentNickname = nickname;
      window.showToday();
    });
  });
}




window.bindUserCardEvents = function () {
  const cards = document.querySelectorAll(".user-card");

  console.log("binding cards:", cards.length); // ?붾쾭源낆슜

  cards.forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      console.log("clicked:", id);
      window.showMyPage(id);
    });
  });
}



window.showMemo = function () {

  const modal = document.getElementById("memoModal");
  const memoInput = document.getElementById("simpleMemo");

  if (!modal || !memoInput) return;

  modal.style.display = "flex";
  modal.classList.add("show");


  memoInput.value = "";
  if (typeof window.updateSimpleMemoCount === "function") {
    window.updateSimpleMemoCount();
  }

  setTimeout(() => {
    memoInput.focus();
    memoInput.setSelectionRange(
      memoInput.value.length,
      memoInput.value.length
    );
  }, 50);
};




window.closeMemo = function () {
    const modal = document.getElementById("memoModal");
    if (!modal) return;
    modal.classList.remove("show");
    modal.style.display = "none";
};





window.saveSimpleMemo = async function () {
  const memoInput = document.getElementById("simpleMemo");
  const imageInput = document.getElementById("fabMemoImage");
  const preview = document.getElementById("memoPreview");
  const fileNameEl = document.getElementById("memoFileName");

  if (!memoInput) return;

  const memoText = memoInput.value.trim();
  const imageFile = imageInput?.files?.[0];

  if (!memoText && !imageFile) return;

  const formData = new FormData();
  formData.append("userId", window.currentUserId || "");
  formData.append("nickname", window.currentNickname || "");
  formData.append("memo", memoText);

  if (imageFile) {
    formData.append("image", imageFile);
  }

  const token = window.token || localStorage.getItem("adminToken") || "";
  const guildId = window.currentGuildId || localStorage.getItem("guildId") || "";
  let url = `/save-feed${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  if (guildId) {
    url += `${url.includes("?") ? "&" : "?"}guildId=${encodeURIComponent(guildId)}`;
  }

  const res = await fetch(url, {
    method: "POST",
    body: formData
  });

  const responseText = await res.text();
  let result = {};
  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch (e) {
    console.error("save-feed parse failed:", responseText);
    return;
  }

  if (!res.ok || !result.ok) {
    console.error("save-feed failed:", res.status, result);
    return;
  }

  memoInput.value = "";
  if (imageInput) {
    imageInput.value = "";
  }
  if (preview) {
    preview.removeAttribute("src");
    preview.style.display = "none";
  }
  if (fileNameEl) {
    fileNameEl.textContent = "선택된 파일 없음";
  }

  setTimeout(() => {
    window.showToday();
  }, 0);
};


window.updateSimpleMemoCount = function () {
  const memoInput = document.getElementById("simpleMemo");
  const countEl = document.getElementById("memoCount");
  if (!memoInput || !countEl) return;
  const len = String(memoInput.value || "").length;
  countEl.textContent = `${len} / 300`;
};




window.deleteFeedItem = async function(id) {

  if (!id) return;

  try {

if (!confirm("삭제하겠습니까?")) return;

 await window.API.fetch(
      `/delete-feed?id=${id}&nickname=${encodeURIComponent(window.currentNickname)}`
    );
await window.showToday();

    

  } catch (err) {
    console.error("삭제 실패:", err);
    if (window.showToast) {
      window.showToast("삭제 실패", "error");
    }
  }

};

if (!window.heartListenerAdded) {
  window.heartListenerAdded = true;

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".feed-like");
    if (!btn) return;

    const feedId = btn.dataset.id;
    const heart = btn.querySelector(".heart-icon");
    const countEl = btn.querySelector(".like-count");

    try {
      const result = await window.API.post("/feed-like", {
        token: window.token,
        feedId,
        userId: window.currentUserId || "",
        nickname: window.currentNickname || ""
      });

      if (!result.ok) return;

      if (countEl) countEl.textContent = Number(result.likes || 0);

      if (result.liked) {
        btn.classList.add("liked");
        if (heart) heart.textContent = "❤️";
      } else {
        btn.classList.remove("liked");
        if (heart) heart.textContent = "🤍";
      }

    } catch (err) {
      console.error(err);
    }
  });
}

