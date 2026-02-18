if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}




let currentMonth = new Date().getMonth() + 1; // 현재 월로 초기화
if (!window.token) {
    window.token = new URLSearchParams(location.search).get('token') || localStorage.getItem("adminToken");
}

window.renderProgress = function(d) {
  const percent = user.goalSec
    ? Math.min(100, Math.floor(d.todaysec / d.goalSec * 100))
    : 0;

  return `
    <div class="progress">
      <div class="progress-bar" style="width:${percent}%"></div>
    </div>
  `;
}

window.formatMin = function(sec) {
  return Math.floor(sec / 60) + '분';
}


window.calcTodayPercent = function(todaysec, goalSec) {
  if (!goalSec) return 0;
  return Math.min(100, Math.round((todaysec / goalSec) * 100));
};




window.renderCalendar = function(view, days) {

  const cal = view.querySelector('.days-calendar');
  if (!cal) return;

  cal.innerHTML = '';

  days.forEach(d => {
    const hours = Math.floor(d.totalSec / 3600);

    cal.innerHTML += `
      <div class="day" onclick="showDayDetail('${d.dayKey}')">
        <div class="day-date">${d.dayKey}</div>
        <div class="day-time">${hours}h</div>
        <div class="day-finalUsers">
          ${d.finalUsers.join(', ')}
        </div>
      </div>
    `;
  });


};


window.formatTime = function (sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}


window.renderToday = function(data) {

  const badgeRow = document.querySelector('.badge-row');
const user = data.finalUsers?.[0]

  badgeRow.innerHTML = `
${user.badge ? `<span class="text-orange-500 font-bold">${user.badge}</span>` : ""} 
${data.isStudying ? '진행중' : '종료'}
    <span class="badge blue">
      ${formatTime(data.todaysec)}
    </span>
  `;
const grid = document.getElementById("dayseGrid");
if (!grid) return;
}


window.renderUserProgress = function(finalUsers) {
  const view = document.getElementById('view');
  view.innerHTML = '';
if (!view) return;
  finalUsers.forEach(user => {
    const percent = Math.min(
      100,
      Math.round((user.todaysec / user.goalSec) * 100)
    );

    view.innerHTML += `
      <div class="user-progress">
        <div class="user-name">${user.name}</div>
        <div class="progress">
          <div class="progress-bar" style="width:${percent}%"></div>
        </div>
      </div>
    `;
  });
const grid = document.getElementById("daysGrid");
if (!grid) return;

}


window.loadMonth = function(month) {

  const view = document.getElementById('view');
if (!view) return;
if (!window.token) return;
  fetch(`/days?token=${encodeURIComponent(window.token)}`)
    .then(r => r.json())
    .then(data => {
      renderCalendar(view, data.days || []);
      renderMonthSummary(data.days || [], month);
    })
    .catch(err => {
      console.error("loadMonth 에러:", err);
    });
};

window.renderMonthSummary = function (days) {
  const totalSec = days.reduce((sum, d) => sum + d.totalSec, 0);
  const h = Math.floor(totalSec / 3600);

  document.querySelector('.month-label').textContent = '이번 달';
  document.querySelector('.month-total').textContent = `${h}시간`;

};





window.showDays = async function(view) {
await window.loadUsers();
const users = window.usersCache;
const data = await window.API.fetch("/days");
if (!view) return;
if (!window.token) return;
  fetch(`/days?token=${encodeURIComponent(window.token)}`)
    .then(r => {
if (!r.ok) throw new Error('서버 응답이 없습니다 (404/500)');
      return r.json();
    })
    .then(data => {
      renderCalendar(view, data.days || []);
      renderMonthSummary(data.days || []);
    })
    .catch(err => {
      console.error("days fetch error:", err);
    });
};


  


window.showDayDetail = async function(dayKey) {
await window.loadUsers();
    const view = document.getElementById("view");
await window.loadUsers();
const users = window.usersCache;
if (!view) return;
  const detail = document.querySelector('.day-detail');

  if (detail) detail.innerHTML = "⌛ 데이터를 불러오는 중...";

const data = await window.API.fetch("/days");   
const days = data.days || []

if (!window.token) return;
  fetch(`/days?token=${encodeURIComponent(window.token)}`)
    .then(r => {
if (!r.ok) throw new Error('서버 응답이 없습니다 (404/500)');
      return r.json();
    })
    .then(data => {

      const day = (data.days || []).find(d => d.dayKey === dayKey);

      if (!day || !day.users.length) {
        detail.innerHTML = `
          <div class="detail-card">
            <h4>📅 ${dayKey}</h4>
            <p>기록된 세션이 없습니다.</p>
          </div>
        `;
        return;
      }

      detail.innerHTML = `
        <div class="detail-card">
          <h4>📅 ${dayKey}</h4>
          ${day.users.map(u => `
            <div class="detail-row">
          <img src="${user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
              <span>${user.name}</span>
              <span>${Math.floor((u.todaySec || 0)/60)}분</span>
            </div>
          `).join('')}
        </div>
      `;

const tbody = document.getElementById("days-tbody");
if (!tbody) return;
tbody.innerHTML = days.map(d => `
  <tr>
    <td>
      ${(d.users| []).map(user => `
        <img src="${user.avatar || '기본이미지'}" class="w-6 h-6 rounded-full" />
      `).join("")}
      ${d.dayKey}
    </td>
    <td>${(d.totalSec / 3600).toFixed(1)}h</td>
  </tr>
`).join("");
    })
    .catch(err => {
      console.error("Detail 로드 실패:", err);
      if (detail) detail.innerHTML =
        `<p style="color:red;">⚠️ 오류: ${err.message}</p>`;

    });
const grid = document.getElementById("daysGrid");
if (!grid) return;
};

window.prevMonth = function () {
  currentMonth--;
  if (currentMonth < 1) currentMonth = 12;
  loadMonth(currentMonth);
};

window.nextMonth = function () {
  currentMonth++;
  if (currentMonth > 12) currentMonth = 1;
  loadMonth(currentMonth);
};







window.renderTodaySummary = function(data) {

const el = document.getElementById("someId");
if (!el) return;  if (!el) return;
  el.innerHTML = `

    <div class="badge-row">
      <span class="badge green">
        ${data.online?.length ? '진행중' : '휴식'}
      </span>
      <span class="badge blue">
        ${Math.floor(data.totalSec / 3600)}h
      </span>
    </div>

    <div class="progress">
      <div class="progress-bar"
           style="width:${Math.min(100, data.percent || 0)}%">
      </div>
    </div>
  `;
const grid = document.getElementById("daysGrid");
if (!grid) return;
};


window.toast = function (msg) {

  const t = document.getElementById('toast');

  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1500);
};

