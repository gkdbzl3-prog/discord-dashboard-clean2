if (!window.token) {
  window.token = localStorage.getItem("adminToken");
}


window.showTotal = async function (mode = 'weekly') {

  const view = document.getElementById("view");
  view.innerHTML = `<div style="text-align:center; padding:50px;">Loading...</div>`;

  try {

    const rawData = await window.API.fetch(
      mode === 'weekly' ? "/weekly" : "/today"
    );

let monthHours = 0;

if (mode === 'weekly') {
  const monthTotalSec = (rawData.days || [])
    .reduce((sum, d) => sum + (d.totalSeconds || 0), 0);

  monthHours = (monthTotalSec / 3600).toFixed(1);
}
    const uniqueMap = new Map();

    if (mode === 'weekly') {
      (rawData.days || []).forEach(d => {
        (d.users || []).forEach(u => {
          const id = u.id || u.userId;
          if (!id) return;

          if (!uniqueMap.has(id)) {
            uniqueMap.set(id, {
              ...u,
              id,
              totalSec: 0
            });
          }

          uniqueMap.get(id).totalSec += Number(u.seconds || 0);
        });
      });

    } else {

      Object.values(rawData || {}).forEach(u => {
        const id = u.id || u.userId;
        if (!id) return;

        uniqueMap.set(id, {
          ...u,
          id,
          totalSec: Number(u.totalSeconds || u.seconds || 0)
        });
      });
    }

    const sorted = Array.from(uniqueMap.values())
      .sort((a, b) => b.totalSec - a.totalSec);

    const communityTotalSec = sorted.reduce(
      (sum, u) => sum + (u.totalSec || 0),
      0
    );

    const totalHours = (communityTotalSec / 3600).toFixed(1);
   const memberCount = sorted.length || 1;
const avgHours = (communityTotalSec / memberCount / 3600).toFixed(1);


    /* ------------------ WEEK GRAPH ------------------ */

    let bars = "";
    if (mode === 'weekly') {
      const weekDays = rawData.days || [];
      const max = Math.max(
        ...weekDays.map(d => d.totalSeconds || 0),
        1
      );

      bars = weekDays.map(d => {
        const percent = Math.round(
          ((d.totalSeconds || 0) / max) * 100
        );

        return `
          <div class="week-bar">
            <div class="week-bar-fill" data-percent="${percent}"></div>
            <div class="bar-label">${d.dayKey.slice(5)}</div>
          </div>
        `;
      }).join("");

setTimeout(() => {
  document.querySelectorAll('.week-bar-fill, .user-bar-fill')
    .forEach(el => {
      const p = el.dataset.percent;
      el.style.width = p + '%';
    });
}, 50);
    }
const maxUser = Math.max(
  ...sorted.map(u => u.totalSec || 0),
  1
);

const userBars = sorted.map(u => {

  const percent = Math.round((u.totalSec / maxUser) * 100);

  return `
    <div class="user-row"
         onclick="window.showMyPage('${u.id}')">

      <div class="user-left">
        <span class="user-name">${u.name}</span>
      </div>

      <div class="user-bar-bg">
        <div class="user-bar-fill"
             data-percent="${percent}"></div>
      </div>

      <div class="user-time">
        ${(u.totalSec/3600).toFixed(1)}h
      </div>

    </div>
  `;
}).join("");
    /* ------------------ RECENT ACTIVITY ------------------ */

    let recentHTML = "";

    if (mode === 'weekly') {

      const recent = [];

      (rawData.days || []).forEach(d => {
        (d.users || []).forEach(u => {
          if (u.seconds > 0) {
            recent.push({
              name: u.name,
              seconds: u.seconds
            });
          }
        });
      });

    recentHTML = recent.slice(0, 5).map(r => `
  <div class="recent-row">
    <div class="recent-left">
      <span class="recent-dot"></span>
      <span>${r.name}</span>
    </div>
    <span class="recent-time">${(r.seconds / 3600).toFixed(1)}h</span>
  </div>
`).join("");
    }

const summaryHTML = `
  <div class="overview-summary">
    <div class="overview-item">
      <div class="overview-label">이번주 참여 유저</div>
      <div class="overview-value">${memberCount}명</div>
    </div>

    <div class="overview-item">
      <div class="overview-label">평균 학습 시간</div>
      <div class="overview-value">${avgHours}h</div>
    </div>
  </div>
`;
    /* ------------------ FINAL RENDER (단 한번만) ------------------ */

    view.innerHTML = `
      <div class="total-container">

        <div class="community-summary">
          <div class="summary-label">
            ${mode === 'weekly' ? 'This Week' : 'All Time'}
          </div>
          <div class="summary-value">
            ${totalHours}<small>h</small>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="label">Members</div>
            <div class="value">${memberCount}</div>
          </div>

        ${mode === 'weekly' ? `
  <div class="summary-card">
    <div class="label">This Month</div>
    <div class="value">${monthHours}<small>h</small></div>
  </div>
` : ""}
        </div>

        ${mode === 'weekly' ? `
          <div class="week-graph">
            ${bars}
          </div>
        ` : ""}

        ${mode === 'weekly' ? `
          <div class="recent-section">
            <div class="section-title">Recent Activity</div>
            ${recentHTML}
          </div>
        ` : ""}

      </div>
    `;

  } catch (e) {
    console.error("Log Error:", e);
    view.innerHTML = `<div style="color:red; padding:50px;">데이터 로딩 실패</div>`;
  }
};



window.toggleFab = function (close = false) {
  const menu = document.getElementById("fabMenu");
  if (!menu) return;

  if (close) {
    menu.classList.remove("open");
  } else {
    menu.classList.toggle("open");
  }
};


  






