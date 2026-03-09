if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}

window.showTotal = async function(mode = "weekly") {
  const view = document.getElementById("view");
  if (!view) return;

  view.innerHTML = `<div style="text-align:center;padding:50px;">Loading...</div>`;
  document.body.classList.add("overview-mode");

  try {
    const rawData = await window.API.fetch(mode === "weekly" ? "/weekly" : "/today");

    const uniqueMap = new Map();

    if (mode === "weekly") {
      (rawData.days || []).forEach((d) => {
        (d.users || []).forEach((u) => {
          const id = u.id || u.userId;
          if (!id) return;
          if (!uniqueMap.has(id)) uniqueMap.set(id, { ...u, id, totalSec: 0 });
          uniqueMap.get(id).totalSec += Number(u.seconds || 0);
        });
      });
    } else {
      Object.values(rawData.users || {}).forEach((u) => {
        const id = u.id || u.userId;
        if (!id) return;
        uniqueMap.set(id, { ...u, id, totalSec: Number(u.totalSeconds || u.seconds || 0) });
      });
    }

    const sorted = Array.from(uniqueMap.values()).sort((a, b) => b.totalSec - a.totalSec);
    const totalSec = sorted.reduce((sum, u) => sum + Number(u.totalSec || 0), 0);
    const totalHours = (totalSec / 3600).toFixed(1);
    const memberCount = sorted.length;
    const avgHours = memberCount ? (totalSec / memberCount / 3600).toFixed(1) : "0.0";
const bestDay = (rawData.days || []).reduce((a,b)=>
  (Number(a.totalSeconds||0) > Number(b.totalSeconds||0) ? a : b), {});
    let monthHours = "0.0";
    if (mode === "weekly") {
      const monthSec = (rawData.days || []).reduce((sum, d) => sum + Number(d.totalSeconds || 0), 0);
      monthHours = (monthSec / 3600).toFixed(1);
    }
const targetHours = 100; // 서버 목표 (원하면 바꿔도 됨)
const progress = Math.min((totalHours / targetHours) * 100, 100).toFixed(0);
    let bars = "";
    if (mode === "weekly") {
      const days = rawData.days || [];
      const max = Math.max(...days.map(d => Number(d.totalSeconds || 0)), 1);
      bars = days.map((d) => {
        const percent = Math.round((Number(d.totalSeconds || 0) / max) * 100);
       return `
<div class="week-bar">

  <div class="week-bar-fill"
       data-percent="${percent}"
       title="${(Number(d.totalSeconds || 0)/3600).toFixed(1)}h">
  </div>

  <div class="bar-label">${(d.dayKey || "").slice(5)}</div>

</div>
`;
      }).join("");
    }


 const recentHtml = sorted.slice(0, 5).map((u, i) => {
      const name = u.name || u.nickname || u.id || "-";
      const hours = (Number(u.totalSec || 0) / 3600).toFixed(1);
      return `
        <div class="recent-row">
          <div class="recent-left"><span class="recent-dot"></span><span>${name}</span></div>
          <span class="recent-time">${hours}h</span>
        </div>

      `;
    }).join("");

    view.innerHTML = `
      <div class="total-container">
       <div class="community-summary">
<div class="graph-title">
  Weekly Activity
</div>
  <div class="summary-label">${mode === "weekly" ? "This Week" : "All Time"}</div>

  <div class="summary-value">${totalHours}<small>h</small></div>

  <div class="community-progress">
    <div class="community-progress-bar">
      <div class="community-progress-fill" style="width:${progress}%"></div>
    </div>
    <div class="community-progress-text">${progress}% of weekly goal</div>
  </div>

</div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="label">Members</div>
            <div class="value">${memberCount}</div>
          </div>
          ${mode === "weekly" ? `
            <div class="summary-card">
              <div class="label">This Month</div>
              <div class="value">${monthHours}<small>h</small></div>
            </div>
          ` : ""}
          <div class="summary-card">
            <div class="label">Avg</div>
            <div class="value">${avgHours}<small>h</small></div>
          </div>
        </div>

        ${mode === "weekly" ? `<div class="week-graph">${bars}</div>` : ""}

        <div class="recent-section">
          <div class="section-title">Recent Activity</div>
          ${recentHtml}
        </div>
      </div>
    `;

    setTimeout(() => {
      document.querySelectorAll(".week-bar-fill").forEach((el) => {
        el.style.height = `${el.dataset.percent || 0}%`;
      });
    }, 30);
  } catch (err) {
    console.error("showTotal error", err);
    view.innerHTML = `<div style="padding:50px;color:red;">데이터 로딩 실패</div>`;
  }
};

window.toggleFab = function(close = false) {
  const menu = document.getElementById("fab-menu");
  if (!menu) return;
  if (close) menu.classList.remove("open");
  else menu.classList.toggle("open");
};
