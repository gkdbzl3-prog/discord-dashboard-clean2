if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}

window.normalizeUsersArray = function(rawUsers) {
  if (Array.isArray(rawUsers)) {
    return rawUsers.filter(Boolean);
  }

  return Object.entries(rawUsers || {})
    .map(([id, user]) => ({ id, ...user }))
    .filter(u => u && u.id);
};

window.buildUsersCache = function(rawUsers) {
  const cache = {};
  window.normalizeUsersArray(rawUsers).forEach(u => {
    cache[String(u.id)] = u;
  });
  return cache;
};







window.formatTime = function (seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}



window.renderSummaryCards = function (users) {

  return users.map(u => {
    const total = Number(u.seconds || 0);
    const totalMinutes = Math.floor(total / 60);
const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";
const avatarUrl =
  u.avatar && u.avatar !== "null"
    ? u.avatar
    : DEFAULT_AVATAR;
    return `
      <div class="tweet summary-card">
   <img class="avatar"
     src="${avatarUrl}"
     onerror="this.src='${DEFAULT_AVATAR}'">
        <div class="tweet-body">
          <div class="tweet-header">
            <span class="name">${u.name}</span>
          </div>
          <div class="tweet-content">
            📊 오늘 ${totalMinutes}분 공부 완료
          </div>
        </div>
      </div>
    `;
  }).join("");


};

window.renderDashboard = function(users) {

  const today = new Date().toLocaleDateString("ko-KR", {
    month: "long", day: "numeric", weekday: "long"
  });

  const activeUsers = users.filter(user =>
  user.currentStart &&
  Date.now() - user.currentStart < 5 * 60 * 1000
);
 const userBlocks = users.map(user => {

  let total = Number(user.seconds || 0);

  // 🔥 여기서 online 직접 계산
 const isOnline =
  user.currentStart &&
  Date.now() - user.currentStart < 5 * 60 * 1000;

  if (isOnline && user.currentStart) {

    const start = new Date(user.currentStart).getTime();
    const now = Date.now();
    const liveSeconds = Math.floor((now - start) / 1000);
    total += liveSeconds;
  }

  const start = new Date(user.currentStart).getTime();
  const now = Date.now();
  const liveSeconds = Math.floor((now - start) / 1000);
  total += liveSeconds;
 
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const timeText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
if (user.online && user.currentStart) {
  const now = Date.now();
  const start = new Date(user.currentStart).getTime();

}
setInterval(() => {
  document.querySelectorAll(".user-card").forEach(card => {
    // online 유저만 시간 계산해서 텍스트 교체
  });
}, 1000);



    const DEFAULT_AVATAR =
      "https://cdn.discordapp.com/embed/avatars/0.png";

    const avatarUrl =
      user.avatar && user.avatar !== "null"
        ? user.avatar
        : DEFAULT_AVATAR;

    return `
      <div class="user-card" data-id="${user.id}" data-nickname="${user.name}"  data-start="${user.currentStart || ''}"
     data-seconds="${user.seconds || 0}">
        <img class="avatar" src="${avatarUrl}">
        <div class="user-name-row">
          <span class="user-name">${user.name}</span>
          <span class="status-dot ${isOnline ? 'live' : ''}"></span>
        </div>
        <div class="user-meta">오늘 ${timeText}</div>
      </div>
    `;

  }).join("");

  return `
    <div class="dashboard-card">
      <div class="dashboard-header">
        <h2>Timeline</h2>
        <div class="timeline-date">
          <div class="date-main">${today}</div>
          <div class="timeline-live">
            🔥 현재 ${activeUsers.length}명 열공 중
          </div>
        </div>
      </div>

      <div class="user-list">
        ${userBlocks}
      </div>
    </div>
  `;


};


window.startLiveCounter = function () {
  if (window.liveCounter) return;

if (window.liveCounter) {
    clearInterval(window.liveCounter);
    window.liveCounter = null;
}
}

window.stopLiveCounter = function () {
 if (window.liveCounter) {
    clearInterval(window.liveCounter);
    window.liveCounter = null;
}
}


window.renderFeed = function(feed, usersObj) {

  const container = document.querySelector(".feed-container");
  if (!container) return;

  container.innerHTML = "";

  feed.forEach(item => {

    const user = usersObj[item.userId];

const nickname = user?.name || item.nickname || "알 수 없음";

const avatarUrl =
  user?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";

    const isMine =
      item.userId === window.currentUserId;

    const timeText = formatFeedTime(item.createdAt);

    const div = document.createElement("div");
    div.className = `feed-item ${isMine ? "mine" : ""}`;

    div.innerHTML = `
<div class="feed-item">

  <div class="feed-left">
    <div class="feed-avatar">
      <img src="${avatarUrl}" />
    </div>

    <div class="feed-main">
      <div class="feed-header">
        <span class="feed-name">${nickname}</span>
        <span class="feed-time">${timeText}</span>
      </div>

      <div class="feed-text">${item.text}</div>
    </div>
  </div>

  <div class="feed-right">
    <button class="heart-btn">💜</button>
  </div>

</div>

      ${isMine ? `
        <span class="delete-btn" data-id="${item.id}">×</span>
      ` : ""}
    `;
    container.appendChild(div);

   const heart = div.querySelector(".heart-btn");
    let liked = false;

    div.addEventListener("dblclick", () => {
      liked = !liked;
      heart.classList.toggle("liked", liked);
    });

    if (isMine) {
      const deleteBtn = div.querySelector(".delete-btn");
      deleteBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        window.deleteFeedItem(item.id);
      });
    }

  });



};



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


window.openProfileModal = function(userId) {
  console.log("프로필 모달 열기:", userId);
};

// 상대 시간을 계산하는 도우미 함수
window.getTimeAgo = function (dateString) {


   // 상대 시간 계산 (dateString이 없을 때의 에러 방어)
    if (!dateString || dateString === "undefined") return "최근 활동"; 
    const now = new Date();
    const past = new Date(dateString);
    if (isNaN(past.getTime())) return "최근 활동"; // 잘못된 날짜 형식 방어

    const diffInMs = now - past;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "오늘";
    if (diffInDays < 7) return `${diffInDays}일 전`;
    return `${Math.floor(diffInDays / 7)}주 전`;
}



window.renderMain = function () {
    const view = document.getElementById("view");
    if (!view || !window.usersCache) return;
const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";
    const validUsers = window.usersCache.filter(u => u.name && u.name !== 'undefined' && u.id);
    const topParticipants = [...validUsers]
        .filter(u => (u.totalSeconds || 0) > 0 || u.online)
        .sort((a, b) => b.online - a.online || (b.totalSeconds || 0) - (a.totalSeconds || 0))
        .slice(0, 8);

    // ✅ 바깥쪽 div에 margin: 0 auto와 중앙 정렬 스타일 추가
    view.innerHTML = `
        <div style="max-width: 820px; margin: 0 auto; padding: 20px; display: flex; flex-direction: column; align-items: center;">
            <div style="width: 100%; margin-bottom: 40px;">
                <h2 style="font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 25px; text-align: center;">Active Members</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; justify-content: center;">
                    ${topParticipants.map(u => `
                        <div class="card" onclick="window.showMyPage('${u.id}')" 
                             style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 25px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: 0.2s;">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <img class="avatar"
     src="${avatarUrl}"
     onerror="this.src='${DEFAULT_AVATAR}'">
                                <div>
                                    <div style="color: #eee; font-weight: 800; font-size: 15px;">${u.name}</div>
                                    <div style="font-size: 11px; color: #a855f7; font-weight: 700;">${((u.totalSeconds || 0)/3600).toFixed(1)}h</div>
                                </div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        </div>
    `;

};


window.showToday = async function () {

console.log("?? showToday called");
let nicknameFromUrl = params.get("nickname");

if (window.isLoadingToday) return;
window.isLoadingToday = true;

try {
  if (!nicknameFromUrl) {
    nicknameFromUrl = localStorage.getItem("nickname");
  }

  if (nicknameFromUrl) {
    localStorage.setItem("nickname", nicknameFromUrl);
  }

  const data = await window.API.fetch("/today");
  const rawUsers = data.users || {};
  const users = Array.isArray(rawUsers)
    ? rawUsers
    : Object.entries(rawUsers).map(([id, user]) => ({ id, ...user }));

  window.usersCache = users.reduce((acc, user) => {
    if (user && user.id) acc[String(user.id)] = user;
    return acc;
  }, {});

  const userEntries = users.map(user => [String(user.id), user]);
  const userIds = userEntries.map(([id]) => id);

  if (userIds.length > 0) {
    window.currentUserId = userIds[0];
  }

  let foundUserId = null;

  if (nicknameFromUrl) {
    for (const [id, user] of userEntries) {
      if (user.name === nicknameFromUrl) {
        foundUserId = id;
        break;
      }
    }
  }

  if (!foundUserId && userEntries.length > 0) {
    foundUserId = userEntries[0][0];
  }

  window.currentUserId = foundUserId;
  window.currentNickname = window.usersCache[foundUserId]?.name || null;

  console.log("currentUserId:", window.currentUserId);

  const view = document.getElementById("view");

  view.innerHTML = `
    ${window.renderDashboard(users)}
    <div id="activityCard" class="activity-card">
      <h3>Activity Feed</h3>
      <div class="feed-container"></div>
    </div>
  `;

  window.renderFeed(data.feed, window.usersCache);
  attachUserCardEvents();
  attachMemoEnter();
} finally {
  window.isLoadingToday = false;
}

};
window.attachUserCardEvents = function () {
 document.querySelectorAll(".user-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      if (!id) return;
      window.showMyPage(id);
    });
  });
}


window.attachMemoEnter = function () {
  const memoInput = document.getElementById("simpleMemo");
  if (!memoInput) return;

  memoInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      window.saveSimpleMemo();
    }
  });
}

window.bindUserCardEvents = function () {
  const cards = document.querySelectorAll(".user-card");

  console.log("binding cards:", cards.length); // 디버깅용

  cards.forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      console.log("clicked:", id);
      window.showMyPage(id);
    });
  });
}



// -----------------
// [함수] 메모 로직
// -----------------
window.showMemo = function () {

  const modal = document.getElementById("memoModal");
  const memoInput = document.getElementById("simpleMemo");

  if (!modal || !memoInput) return;

  modal.style.display = "flex";

  // 열 때 초기화
  memoInput.value = "";

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
    if (modal) modal.style.display = "none";
modal.classList.add("show");
modal.classList.remove("show");};





window.saveSimpleMemo = async function() {

  const memoInput = document.getElementById("simpleMemo");
  if (!memoInput) return;

  const memoText = memoInput.value.trim();
  if (!memoText) return;

  const memoModal = document.getElementById("memoModal");

  await window.API.fetch(
    `/save-feed?nickname=${window.currentNickname}&memo=${encodeURIComponent(memoText)}`
  );

  memoInput.value = "";

  if (memoModal) memoModal.style.display = "none";

  // 🔥 여기서 바로 DOM 접근 끝났음
  // 🔥 이제야 안전하게 다시 렌더 가능

  setTimeout(() => {
    window.showToday();
  }, 0);
};




window.deleteFeedItem = async function(id) {

  if (!id) return;

  try {

   if (!confirm("삭제할까요?")) return;

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