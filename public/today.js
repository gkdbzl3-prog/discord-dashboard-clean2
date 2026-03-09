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
    const totalAllText = formatTime(user.totalSeconds || 0);

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



 document.querySelectorAll(".user-card").forEach(card => {

    const userId = card.dataset.id;
    const user = window.usersCache[userId];
    if (!user) return;

    
localStorage.setItem("studyStart", Date.now());



  const todaySeconds = getTodaySeconds(user);


const hours = Math.floor(todaySeconds / 3600);
const minutes = Math.floor((todaySeconds % 3600) / 60);

const timeText =
  hours > 0
    ? `${hours}시간 ${minutes}분`
    : `${minutes}분`;
   const meta = card.querySelector(".user-meta");
if (meta) meta.textContent = `오늘 ${timeText}`;
   



  });
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

  const now = Date.now();
  const today = new Date();
  today.setHours(0,0,0,0);

  const sessionsForTotal = window.getAggregateSessions(user.sessions || []);
  let todaySeconds = sessionsForTotal
    .filter(s => new Date(s.start) >= today)
    .reduce((sum, s) => sum + (s.seconds || 0), 0);

 
  if (user.currentStart && window.isUserOnline(user)) {
    const startTime = Number(user.currentStart);

    if (startTime >= today.getTime()) {
      todaySeconds += Math.floor((now - startTime) / 1000);
    }
  }
  return todaySeconds;
};


window.startDashboardInterval = function () {

  if (window.dashboardInterval) return;

  window.dashboardInterval = setInterval(async () => {

    const rawData = await window.API.fetch("/today");
    window.applyTodayUsers(rawData.users);
    window.renderDashboard();
    window.updateOnlineStatus(rawData.users);

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

window.updateDashboardLiveCounters = function () {
  const users = Object.values(window.usersCache || {})
    .filter((u) => u && u.id)
    .filter((u) => u.id !== "users")
    .filter((u) => u.id !== "1466022968860737649");

  users.forEach((user) => {
    const card = document.querySelector(`.user-card[data-id="${user.id}"]`);
    if (!card) return;

    const todayText = formatTime(getTodaySeconds(user));
    const totalAllText = formatTime(user.totalSeconds || 0);

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

  Object.values(users).forEach(user => {

    const level = getUserLevel(user.totalSeconds);

    const el = document.querySelector(`[data-user="${user.id}"]`);

    if(!el) return;

    el.querySelector(".level-label").innerText = level.label;

  });

}



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
  if (!item || typeof item !== "object") return "";

  const user = window.usersCache[String(item.userId)];

    if (!user) return "";

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


}

window.createFeed = async function(text){
  const nickname = window.currentNickname || localStorage.getItem("nickname") || "unknown";
  await window.API.fetch(
    `/save-feed?nickname=${encodeURIComponent(nickname)}&memo=${encodeURIComponent(text || "")}`
  );

  window.loadFeed();

};

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

  window.applyTodayUsers(rawData.users);

  window.renderTodayLayout();   // ?뵦 癒쇱? 援ъ“ ?앹꽦
  window.renderDashboard();     // ?뵦 洹??ㅼ쓬 ?곗씠???뚮뜑
  window.renderFeed(rawData.feed);

  window.startDashboardInterval();
};

window.renderTodayLayout = function() {

  const view = document.getElementById("view");

  view.innerHTML = `

      <div id="dashboardSection" class="dashboard-grid"></div>

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

  if (memoModal) {
    memoModal.classList.remove("show");
    memoModal.style.display = "none";
  }

  


  setTimeout(() => {
    window.showToday();
  }, 0);
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

