// mypage.js – 개인/공용 선택, 유저 선택, 닉네임 표시

if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}



window.currentCalendarDate = new Date();

window.SUBJECTS = [
  "국어",
  "한국사",
  "영어",
  "일본어",
  "중국어",
  "코딩",
  "컴활"
];

const DAY_MS = 24 * 60 * 60 * 1000;

window.getAggregateSessionList = function (sessions = []) {
  const list = Array.isArray(sessions) ? sessions : [];
  const hasTagged = list.some((s) => typeof s?.source === "string");
  if (!hasTagged) return list;
  return list.filter((s) => !s?.source || s?.source === "camera_event" || s?.source === "manual" || s?.manual === true);
};

window.changeMonth = function(delta){

  const d = new Date(window.currentCalendarDate);

  d.setMonth(d.getMonth() + delta);

  window.currentCalendarDate = d;

  window.renderCalendar();
  window.renderRecordList();
  window.updateMonthLabel();

};

window.setCalendarMonth = function(year, month){

  window.currentCalendarDate = new Date(year, month, 1);

  window.renderCalendar();
  window.renderRecordList();
};

window.getMonthlyTotalMinutes = function (sessions = []) {

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let totalSeconds = 0;

  for (const s of sessions) {

  const date = new Date(record.date);
const timeStr =
  date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) +
  ' ' +
  date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

    if (
      date.getFullYear() === year &&
      date.getMonth() === month
    ) {
      totalSeconds += (s.seconds || 0);
    }
  }

  return Math.floor(totalSeconds / 60);
};

window.selectedSubject = null;

window.formatHM = function(seconds){

  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);

  return String(h).padStart(2,"0") + ":" +
         String(m).padStart(2,"0");

};



window.renderSubjectList = function() {
  const list = document.getElementById("subjectList");
  if (!list) return;

  list.innerHTML = SUBJECTS.map(s => {
    const color = window.generateTagColor(s);
    return `
      <div class="subject-item"
           style="color:${color.text}"
         onclick="window.selectSubject('${s}')">
        #${s}
      </div>
    `;
  }).join("") + `
    <div class="subject-add"
         onclick="window.addNewSubject()">
      + 과목 추가
    </div>
  `;
};


window.loadMyPageUsers = async function () {

  const res = await fetch("/mypage");
const data = await res.json();

let list = [];
if (Array.isArray(data)) {
  list = data;
} else if (data && Array.isArray(data.users)) {
  list = data.users;
}



  const cache = {};

  list.forEach(u => {
    if (u && u.id) {
      cache[u.id] = u;
    }
  });

  return cache;
};

window.renderManualProgress = function() {

  const el = document.getElementById("manualProgress");
  if (!el || !window.currentUser) return;

  const user = window.currentUser;

  const total = window.getMonthlyTotalMinutes(user.sessions || []);

  const hours = Math.floor(total / 60);
  const mins = total % 60;

  el.innerText = `현재 누적: ${hours}시간 ${mins}분`;
};

window.getMonthlyHoursFromSessions = function(sessions = []) {

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 1).getTime();

  let totalSec = 0;

  sessions.forEach(s => {
let start = s.start;
let end = s.end;

if (typeof start === "string") start = new Date(start).getTime();
if (typeof end === "string") end = new Date(end).getTime();


    const overlapStart = Math.max(start, monthStart);
    const overlapEnd = Math.min(end, monthEnd);

    if (overlapEnd > overlapStart) {
      totalSec += (overlapEnd - overlapStart) / 1000;
    }
  });

  return totalSec / 3600;
};

window.selectSubject = function(subject) { 
const active = document.getElementById("activeSubject"); 
if (!active) return; 

const selected = Array.isArray(window.currentSelectedSubjects) 
? [...window.currentSelectedSubjects] : []; 
if (!selected.includes(subject)) { selected.push(subject); } 

window.currentSelectedSubjects = selected; 
window.currentSelectedSubject = selected[0] || null; 

active.innerHTML = selected.map((s) => ` 
<span class="active-subject-tag"> 
<span class="subject-text">#${s}</span> 
<button type="button" onclick="window.removeSubject('${s}')" class="remove-subject-btn" aria-label="${s} 삭제" >✕</button> 
</span> 
`).join(""); 

active.dataset.subject = selected[0] || ""; 
active.dataset.subjects = JSON.stringify(selected); 
window.insertSubjectTagToMemo(subject); 
};

window.daySessionExpandMap = window.daySessionExpandMap || {};

window.addNewSubject = function () {

  const name = prompt("새 과목 이름");
  const normalized = String(name || "").trim();

  if (!normalized) return;

  const exists = SUBJECTS.some(
    (s) => String(s).trim() === normalized
  );

  if (exists) {
    window.showToast("이미 있는 과목입니다");
    return;
  }

  SUBJECTS.push(normalized);

  window.renderSubjectPalette();
  window.renderSubjectList();

  window.showToast(`#${normalized} 과목이 추가되었습니다`);

  // 🔥 새 과목 자동 선택
  window.selectSubject(normalized);

  // 🔥 memoEditor에도 태그 자동 삽입
  window.insertSubjectTagToMemo(normalized);

};

window.getTotalSeconds = function(user) {

  let total = 0;

  (user.sessions || []).forEach(s => {

    const start = window.normalizeTime(s.start);
    const end   = window.normalizeTime(s.end);

    if (!start || !end) return;

    total += (end - start) / 1000;

  });

  return total;
};



window.renderSkeletonUI = function() {
  const view = document.getElementById("view");

  view.innerHTML = `
    <div class="mypage-card">
      <div class="skeleton skeleton-circle"></div>
      <div class="skeleton skeleton-title"></div>

      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    </div>
  `;
};

window.generateTagColor = function(tagName) {

  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }

  const h = Math.abs(hash % 360);

  return {
    bg: `hsla(${h}, 70%, 85%, 0.5)`,
    border: `hsl(${h}, 70%, 55%)`,
    text: `hsl(${h}, 70%, 40%)`
  };
};

window.showMyPage = async function(userId) {

  window.renderSkeletonUI();   // 🔥 즉시 UI 표시

  const myPageCache = await window.loadMyPageUsers();
const user = myPageCache[userId];
if (!user) return;

const {
  allSessions,
  manualSessions,
  eventSessions,
  autoSplitSessions,
  mainSessions,
  detailSessions
} = window.splitUserSessions(user);

window.currentAllSessions = allSessions;
window.currentManualSessions = manualSessions;
window.currentEventSessions = eventSessions;
window.currentAutoSplitSessions = autoSplitSessions;
window.currentMainSessions = mainSessions;
window.currentDetailSessions = detailSessions;




 window.currentUser = user;
window.currentUserId = user.id;   // ✅ 여기서만 세팅




 

  window.isOnMyPage = true;
window.currentUserName = user.name;

if (!Array.isArray(user.freeGoals)) {
  user.freeGoals = [];
}


const local = localStorage.getItem(`records_${user.id}`);
if (local) {
  try {
    const parsed = JSON.parse(local);
    window.currentStudyRecords = Array.isArray(parsed)
      ? parsed.filter((r) => r && typeof r === "object")
      : [];
  } catch (e) {
    window.currentStudyRecords = [];
  }
} else {
  window.currentStudyRecords = Array.isArray(user.studyRecords)
    ? user.studyRecords.filter((r) => r && typeof r === "object")
    : [];
}




const displayName =
  user.nickname ||
  user.name ||
  user.username ||
  "Unknown";
const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

const avatarUrl =
  user?.avatar && user.avatar !== "null"
    ? user.avatar
    : DEFAULT_AVATAR;

  
const hasMemo =
  user.memo && user.memo.trim().length > 0;

const initialMemo = hasMemo
  ? window.convertTextToTags(user.memo)
  : "";
const badges = window.getBadges(user);


window.currentSelectedSubject = null;

const sessions = Array.isArray(user.sessions) ? user.sessions : [];
window.currentDayStudyMap = window.buildDayStudyMap(sessions);


const now = new Date();



 view.innerHTML = `
    <button onclick="window.showToday()" class="back-btn">
      ← Back
    </button>

 <div class="mypage-card">

    <!-- 프로필 카드 -->
    <div class="profile-card">
      <img class="profile-avatar" src="${avatarUrl}" onerror="this.src='${DEFAULT_AVATAR}'">
      <h2 class="profile-name">${displayName}</h2>
      
      <!-- 🌟 레벨/뱃지 표시 (새로운 요소!) -->
      <div class="profile-badges">
        ${badges.map(b => `<span class="mini-badge">${b}</span>`).join('')}
      </div>
    </div>

    <!-- 목표 섹션 -->
<div class="mypage-widgets">

  <!-- 이번달 목표 -->
   <div class="widget-card">
    <div class="goal-header">
      <span class="goal-icon">👟</span>
      <h3 class="goal-title">이번 달 목표</h3>
    </div>

  

    <div id="timeGoalBox"></div>
  </div>


  <!-- 주간 진행률 -->
   <div class="widget-card">
    <div class="goal-header">
      <span class="goal-icon">📊</span>
      <h3 class="goal-title">이번 주 진행률</h3>
    </div>

    <div id="weeklyStatusText"></div>
  </div>


  <!-- 자유 목표 -->
   <div class="widget-card">
    <div id="freeGoalList"></div>
  </div>


  <!-- 주간 그래프 -->
   <div class="widget-card">
    <h3 class="block-title">📊 WEEKLY STUDY</h3>
    <canvas id="weeklyChart"></canvas>
  </div>

</div>


<!-- 출석 블록 -->
    <div class="mypage-block attendance-block">
      <div class="block-header">

        <h3 class="block-title">📅 ATTENDANCE</h3>
<div class="calendar-month-header">

<button class="calendar-nav-btn" onclick="window.changeMonth(-1)">
◀
</button>

<div class="calendar-month-label" onclick="window.toggleMonthDropdown()">
<span id="calendarMonthText" class="calendar-dropdown-arrow">March</span>

</div>

<button class="calendar-nav-btn" onclick="window.changeMonth(1)">
▶
</button>

</div>

<div id="calendarMonthDropdown" class="calendar-month-dropdown"></div>



        <div class="attendance-quick-stats">
          <div id="streakBox" class="stat-pill"></div>
          <div id="badgeBox" class="stat-pill"></div>
        </div>
      </div>

      <div id="monthlySummary" class="monthly-summary"></div>

      <!-- 🌟 달력 그리드 (크게!) -->
      <div class="calendar-container">
        <div class="calendar-grid">
                     ${Array.from({length: 28}, (_, i) => {

  const day = i + 1;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const dayStart = new Date(year, month, day, 0, 0, 0, 0).getTime();
  const dayEnd = new Date(year, month, day + 1, 0, 0, 0, 0).getTime();

const totalSeconds = window.getDayStudySeconds(
  window.currentMainSessions,
  year,
  month,
  day
);

const isAttended = totalSeconds > 0;
const hours = (totalSeconds / 3600).toFixed(1);



            return `
              <div class="calendar-day ${isAttended ? 'attended' : ''}"
                   data-detail="${hours}h"
                   data-day="${day}"
                   onclick="window.showDayDetail(${day})">
                <span class="calendar-date">${day}</span>
                
              </div>
            `;
          }).join('')}
        </div>
      </div>
  <div class="monthly-hint">
        *날짜칸을 클릭하면 상세정보가 뜹니다.
      </div>
      <div id="calendarDetail" class="calendar-detail"></div>
      
   
    </div>

  <!-- STUDY NOTE 섹션 -->
<div class="study-note-block">

<h3 class="block-title">📝 STUDY NOTE</h3>

<div id="subjectPalette" class="subject-palette hidden"></div>

<div id="activeSubject" class="active-subject"></div>

<textarea
  id="memoEditor"
  class="memo-editor"
  placeholder="#을 넣어 과목을 설정해보세요.

• 새로운 개념이나 용어
• 어려웠던 부분
• 다음에 복습할 내용"
  rows="4"></textarea>

<button class="note-save-btn" onclick="window.saveMemoRecord()">
저장
</button>

<div id="recordList" class="record-list"></div>

<div id="subjectStats" class="subject-stats"></div>

</div>
`;

if (!window.currentUser.freeGoals) {
  window.currentUser.freeGoals = [];
}




const streak = window.getStreakFromSessions(user.sessions || []);

const streakEl = document.getElementById("streakBox");
if (streakEl) {
  streakEl.innerText = `🔥 ${streak}일 연속 공부 중`;
}


const input = document.getElementById("recordInput");

if (input) {
  input.onkeydown = function(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      window.addStudyRecord();
    }
  };
}
const badgeBox = document.getElementById("badgeBox");

if (badgeBox) {
  badgeBox.innerHTML = badges.length
    ? badges.map((b) => `<span class="badge">${b}</span>`).join("")
    : `<span class="badge badge-empty">뱃지 없음</span>`;
}
setTimeout(() => {
const editor = document.getElementById("memoEditor");
  if (!editor) return;

  if (editor.innerText.trim().length === 0) {
    editor.classList.add("empty");
  } else {
    editor.classList.remove("empty");
  }
}, 0);






const grid = document.querySelector(".calendar-grid");

if (grid) {
  grid.onclick = function (e) {

    const cell = e.target.closest(".calendar-day");
    if (!cell) return;

    const selectedDay = parseInt(
      cell.querySelector(".calendar-date").innerText
    );
    window.showDayDetail(selectedDay);
  };
}

const memoEditorEl = document.getElementById("memoEditor");

memoEditorEl?.addEventListener("input", (e) => {
  const value = e.target.value;

  if (value.endsWith("#")) {
    document.getElementById("subjectPalette")?.classList.remove("hidden");
  }
});

document.getElementById("newGoalInput")
  ?.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      window.addFreeGoal();
    }
  });


document.body.classList.remove("overview-mode");
document.body.classList.remove("dashboard-mode");
  document.body.classList.add("mypage")


window.initMemoEditor();
window.renderTimeGoal(user);
window.renderMonthlySummary();
window.renderWeeklyStatus(user);
window.renderFreeGoals();
window.renderSubjectPalette();
window.renderSubjectList();
window.currentStudyRecords = Array.isArray(window.currentStudyRecords)
  ? window.currentStudyRecords
  : (window.currentUser.studyRecords || []);
window.renderRecordList();
window.renderWeeklyGoalCompare(window.currentUser);
window.renderWeeklyChart();
}


window.showOldRecords = false;

window.toggleOldRecords = function() {

  window.showOldRecords = !window.showOldRecords;

  window.renderRecordList();

};

window.removeSubject = function (subject) {

  const active = document.getElementById("activeSubject");
  if (!active) return;

  const selected = Array.isArray(window.currentSelectedSubjects)
    ? window.currentSelectedSubjects.filter((s) => s !== subject)
    : [];

  window.currentSelectedSubjects = selected;
  window.currentSelectedSubject = selected[0] || null;

  active.innerHTML = selected.map((s) => `
    <span class="active-subject-tag">
      <span class="subject-text">#${s}</span>
      <button
        type="button"
        onclick="window.removeSubject('${s}')"
        class="remove-subject-btn"
      >✕</button>
    </span>
  `).join("");

  if (selected.length) {
    active.dataset.subject = selected[0];
    active.dataset.subjects = JSON.stringify(selected);
  } else {
    delete active.dataset.subject;
    delete active.dataset.subjects;
  }

};


window.toggleMonthDropdown = function(){

const box = document.getElementById("calendarMonthDropdown");

if(!box) return;

box.classList.toggle("show");

};


window.renderMonthDropdown = function(){

const box = document.getElementById("calendarMonthDropdown");
if(!box) return;

const now = new Date();

let html = "";

for(let i=-12;i<=12;i++){

const d = new Date(now);

d.setMonth(d.getMonth()+i);

const y = d.getFullYear();
const m = d.getMonth();

html += `
<div class="calendar-month-option"
onclick="window.setCalendarMonth(${y},${m})">
${y}년 ${m+1}월
</div>
`;

}

box.innerHTML = html;

};




window.clearSubject = function () { 

window.currentSelectedSubject = null; 
window.currentSelectedSubjects = []; 

const active = document.getElementById("activeSubject"); 
if (active) { active.innerHTML = ""; 

delete active.dataset.subject; 
delete active.dataset.subjects; 
} 

};


window.openGoalInput = function(){

  const area = document.querySelector(".goal-input-area");
  if(!area) return;

  area.innerHTML = `
    <input
      id="goalTextInput"
      class="goal-text-input"
      placeholder="새 목표 입력..."
    >

    <button
      class="goal-save-btn"
      onclick="window.saveNewGoal()"
    >
      추가
    </button>
  `;

  const input = document.getElementById("goalTextInput");

  if(input){
    input.focus();

    input.onkeydown = function(e){
      if(e.key === "Enter"){
        window.saveNewGoal();
      }
    };
  }

};

window.openGoalInput = function(){

  const area = document.querySelector(".goal-input-area");
  if(!area) return;

  area.innerHTML = `
    <input
      id="goalTextInput"
      class="goal-text-input"
      placeholder="새 목표 입력..."
    >

    <button
      class="goal-save-btn"
      onclick="window.saveNewGoal()"
    >
      추가
    </button>
  `;

  const input = document.getElementById("goalTextInput");

  if(input){
    input.focus();

    input.onkeydown = function(e){
      if(e.key === "Enter"){
        window.saveNewGoal();
      }
    };
  }

};


window.renderWeeklyChart = function(){

const ctx = document.getElementById("weeklyChart");
if(!ctx) return;

const sessions = window.currentMainSessions || [];

const days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const data=[0,0,0,0,0,0,0];

sessions.forEach(s=>{

const start=new Date(s.start);

const day=start.getDay();

const sec = s.seconds ||
Math.floor((s.end-s.start)/1000);

data[day]+=sec;

});

const hours=data.map(v=>v/3600);

new Chart(ctx,{

type:"bar",

data:{
labels:days,
datasets:[{
data:hours,
backgroundColor:"rgba(168,85,247,0.6)",
borderRadius:6
}]
},

options:{
plugins:{legend:{display:false}},
scales:{
y:{
beginAtZero:true,
ticks:{
callback:(v)=>v+"h"
}
}
}
}

});

};

window.updateMonthLabel = function(){

const d = window.currentCalendarDate;

const monthNames = [
"January","February","March","April",
"May","June","July","August",
"September","October","November","December"
];

document.getElementById("calendarMonthText").innerText =
`${monthNames[d.getMonth()]} ${d.getFullYear()}`;

};


window.toggleDaySessionExpand = function(dayKey) { 

window.daySessionExpandMap[dayKey] = !window.daySessionExpandMap[dayKey]; 

const parts = String(dayKey).split("-"); 
const day = Number(parts[2]); 

if (Number.isFinite(day)) { window.showDayDetail(day); } 
};

// ===== 과목 팔레트 토글 =====
window.toggleTagPalette = function() {
  const palette = document.getElementById("subjectPalette");
  if (!palette) return;

  palette.classList.toggle("hidden");
};

// ===== 과목 선택 =====
window.selectSubject = function(subject) {
  const active = document.getElementById("activeSubject");
  if (!active) return;

  const selected = Array.isArray(window.currentSelectedSubjects)
    ? window.currentSelectedSubjects
    : [];

  if (!selected.includes(subject)) selected.push(subject);
  window.currentSelectedSubjects = selected;
  window.currentSelectedSubject = selected[0] || null;

  active.innerHTML = selected.map((s) => `
    <span class="active-subject-chip">
      #${s}
  <button class="chip-x">×</button>
</span>
  `).join("");

  active.dataset.subject = selected[0] || "";
  active.dataset.subjects = JSON.stringify(selected);
};


window.renderCalendar = function () {

  const grid = document.querySelector(".calendar-grid");
  if (!grid) return;

  const user = window.currentUser || {};

  const d = window.currentCalendarDate || new Date();

  const year = d.getFullYear();
  const month = d.getMonth();

  const days = 28;

  grid.innerHTML = Array.from({ length: days }, (_, i) => {

    const day = i + 1;

    const totalSeconds = window.getDayStudySeconds(
      window.currentMainSessions || [],
      year,
      month,
      day
    );

    const isAttended = totalSeconds > 0;

    const hours = (totalSeconds / 3600).toFixed(1);

    return `
      <div class="calendar-day ${isAttended ? "attended" : ""}"
           data-day="${day}"
           data-detail="${hours}h"
           onclick="window.showDayDetail(${day})">

        <span class="calendar-date">${day}</span>

      </div>
    `;
  }).join("");

};

window.renderGoalProgress = function(){

const goals = window.currentUser?.freeGoals || [];

if(!goals.length) return "";

const done = goals.filter(g=>g.done).length;

const percent = Math.round(done/goals.length*100);

return `
<div class="goal-progress">

<div class="goal-progress-bar">
<div class="goal-progress-fill" style="width:${percent}%"></div>
</div>

<div class="goal-progress-text">
${done} / ${goals.length} 완료
</div>

</div>
`;

}

window.saveMemoRecord = function(){

const editor = document.getElementById("memoEditor");
const active = document.getElementById("activeSubject");
const text = (editor?.value || "").trim();

let selectedFromDataset = [];
try {
  selectedFromDataset = JSON.parse(active?.dataset?.subjects || "[]");
} catch (e) {
  selectedFromDataset = [];
}

const selected = Array.isArray(window.currentSelectedSubjects)
  ? window.currentSelectedSubjects
  : [];

const tagsInText = Array.from(text.matchAll(/#([^\s#]+)/g)).map((m) => m[1]);
const subjects = Array.from(new Set([
  ...selected,
  ...selectedFromDataset,
  ...(window.currentSelectedSubject ? [window.currentSelectedSubject] : []),
  ...(active?.dataset?.subject ? [active.dataset.subject] : []),
  ...tagsInText
].filter(Boolean)));

if (subjects.length === 0) {
  window.showToast("Select or type at least one tag", "error");
  return;
}

if (!text) {
  window.showToast("Write some content", "error");
  return;
}

const raw = memoEditor.value.trim();

const parsed = window.parseStudyTags(raw);

const record = {
  id: Date.now(),
  subjects: parsed.subjects,
  content: parsed.content,
  timestamp: Date.now()
};

const userId = window.currentUserId;
const records = JSON.parse(localStorage.getItem(`records_${userId}`) || "[]");

records.unshift(record);
localStorage.setItem(`records_${userId}`, JSON.stringify(records));
window.currentStudyRecords = records;

editor.value = "";
window.currentSelectedSubject = null;
window.currentSelectedSubjects = [];
if (active) {
  active.innerHTML = "";
  delete active.dataset.subject;
  delete active.dataset.subjects;
}

window.renderRecordList();
window.showToast("저장완료!");

};;

// ===== 기록 리스트 렌더링 =====
window.renderRecordList = function(){

const recordList = document.getElementById("recordList");
if(!recordList) return;

const userId = window.currentUserId;
const raw = JSON.parse(localStorage.getItem(`records_${userId}`) || "[]");
const records = Array.isArray(raw) ? raw : (window.currentStudyRecords || []);
window.currentStudyRecords = records;
  const now = new Date();
const d = window.currentCalendarDate;

const year = d.getFullYear();
const month = d.getMonth();

const recordsToShow = records.filter(r=>{

  const t = new Date(r.timestamp);

  return (
    t.getFullYear() === year &&
    t.getMonth() === month
  );

});

 
const currentMonthRecords = records.filter(r => {

  const d = new Date(r.timestamp);

  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth()
  );

});



 recordList.innerHTML = currentMonthRecords.map(record => {
    const rawTs = record.timestamp || record.createdAt || record.date || null;
    const date = rawTs ? new Date(rawTs) : null;
    const valid = date && !Number.isNaN(date.getTime());
    const timeStr = valid
      ? date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ' ' +
        date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '-';

    const subjects = Array.isArray(record.subjects) && record.subjects.length
      ? record.subjects
      : [record.subject].filter(Boolean);

    const subjectHtml = subjects.map((s) => {
      const colors = window.generateTagColor(s);
      return `<span class="record-subject-tag" style="background: ${colors.bg}; color: ${colors.text};">#${s}</span>`;
    }).join('');

    return `
      <div class="record-item" data-id="${record.id}">
        <div class="record-header">
          <div class="record-tags">${subjectHtml}</div>
          <button class="record-delete-btn" onclick="window.deleteRecord(${record.id})">Delete</button>
        </div>
        <div class="record-content">${record.content}</div>
        <div class="record-time">${timeStr}</div>
      </div>
    `;
  }).join('');

window.renderSubjectStats(currentMonthRecords);
};

window.renderStudyRecords = window.renderRecordList;


// ===== 기록 삭제 =====
window.deleteRecord = function(recordId) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  
  const userId = window.currentUserId;
  const records = JSON.parse(localStorage.getItem(`records_${userId}`) || '[]');
  const filtered = records.filter(r => r.id !== recordId);
  localStorage.setItem(`records_${userId}`, JSON.stringify(filtered));
  
  window.renderRecordList();
  window.showToast('삭제되었습니다');
};


window.renderSubjectPalette = function () {

  const palette = document.getElementById("subjectPalette");
  if (!palette) return;

  palette.innerHTML =
    SUBJECTS.map((s) => {

      const color = window.generateTagColor(s);

      return `
      <button
        class="subject-palette-btn"
        onclick="window.selectSubject('${s}')"
        style="--tag-bg:${color.bg}; --tag-text:${color.text}">
        #${s}
      </button>
      `;

    }).join("") +

    `
    <button class="subject-add-btn" onclick="window.addNewSubject()">
      + 새 과목 추가
    </button>
    `;
};

window.parseStudyTags = function(text) {

  if (!text) return { subjects: [], content: "" };

  const tagRegex = /#([^\s#]+)/g;

  const subjects = [];
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    subjects.push(match[1]);
  }

  const content = text.replace(tagRegex, "").trim();

  return {
    subjects,
    content
  };

};


window.insertSubjectTagToMemo = function (subject) {

  const editor = document.getElementById("memoEditor");
  if (!editor || !subject) return;

  const tag = `#${subject}`;

  if (editor.value.includes(tag)) return;

  editor.value = `${tag} ${editor.value}`.trim();

  editor.focus();

};

window.buildDayStudyMap = function (sessions = []) {
  const map = {};

  for (const s of sessions) {
    if (!s) continue;

    const start = new Date(s.startTime || s.startedAt || s.start || 0);
    if (Number.isNaN(start.getTime())) continue;

    const day = start.getDate();
    const seconds = Number(s.seconds || s.duration || s.totalSeconds || 0);

    map[day] = (map[day] || 0) + seconds;
  }

  return map;
};

// ===== 과목별 통계 렌더링 =====
window.renderSubjectStats = function(records) {
  const statsDiv = document.getElementById('subjectStats');
  if (!statsDiv || records.length === 0) {
    if (statsDiv) statsDiv.innerHTML = '';
    return;
  }
  
  // 과목별 카운트
  const subjectCount = {};
  records.forEach(r => {
    subjectCount[r.subject] = (subjectCount[r.subject] || 0) + 1;
  });
  
  const sorted = Object.entries(subjectCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // 상위 5개
  
  if (sorted.length === 0) return;
  
  statsDiv.innerHTML = `
    <div class="stats-title">📊 과목별 기록 통계</div>
    <div class="stats-grid">
      ${sorted.map(([subject, count]) => {
        const colors = window.generateTagColor(subject);
        return `
          <div class="stat-item">
            <div class="stat-subject" style="background: ${colors.bg}; color: ${colors.text};">
              #${subject}
            </div>
            <div class="stat-count">${count}개</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
};

window.initCalendarMonthSelect = function(){

  const select = document.getElementById("calendarMonthSelect");
  if(!select) return;

  const now = new Date();

  let html = "";

  for(let i=-12;i<=12;i++){

    const d = new Date(now);
    d.setMonth(d.getMonth()+i);

    const y = d.getFullYear();
    const m = d.getMonth();

    html += `<option value="${y}-${m}">
    ${y}년 ${m+1}월
    </option>`;
  }

  select.innerHTML = html;

  select.onchange = function(){

    const [y,m] = this.value.split("-");

    window.setCalendarMonth(Number(y),Number(m));

  };

};

if (typeof window.showToast !== "function") {
  window.showToast = function(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  };
}



window.showDayDetail = function (day) {
  const detailDiv = document.getElementById("calendarDetail");
  if (!detailDiv) return;

  const now = new Date();
const year = now.getFullYear();
const month = now.getMonth();
const dayKey = `${year}-${month + 1}-${day}`; 
const expanded = !!window.daySessionExpandMap[dayKey];
  const dayStart = new Date(year, month, day, 0, 0, 0, 0).getTime();
  const dayEnd = new Date(year, month, day + 1, 0, 0, 0, 0).getTime();

  const sessions = Array.isArray(window.currentDetailSessions)
    ? window.currentDetailSessions
    : [];

  const rawLocal = JSON.parse(
    localStorage.getItem(`records_${window.currentUserId}`) || "[]"
  );

  const baseRecords =
    Array.isArray(rawLocal) && rawLocal.length
      ? rawLocal
      : Array.isArray(window.currentStudyRecords)
      ? window.currentStudyRecords
      : [];

  const getSessionSeconds = (s) => {
    if (Number.isFinite(s?.seconds) && s.seconds > 0) return s.seconds;

    const start = new Date(s?.start).getTime();
    const end = new Date(s?.end).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return 0;
    }

    return Math.floor((end - start) / 1000);
  };

  const daySessions = sessions.filter((s) => {
    const start = new Date(s?.start).getTime();
    const end = new Date(s?.end).getTime();

    if (!Number.isFinite(start)) return false;

    const safeEnd = Number.isFinite(end) ? end : start;
    return safeEnd > dayStart && start < dayEnd;
  });

  const normalizedDaySessions = daySessions
    .map((s) => {
      const startMs = new Date(s?.start).getTime();
      const endRaw = new Date(s?.end).getTime();
      const seconds = getSessionSeconds(s);

      const endMs =
        Number.isFinite(endRaw) && endRaw > startMs
          ? endRaw
          : startMs + seconds * 1000;

      return {
        ...s,
        __startMs: startMs,
        __endMs: endMs,
        __seconds: seconds,
        __manual: s?.manual === true || s?.source === "manual",
        __source: s?.source || "legacy",
      };
    })
    .filter((s) => Number.isFinite(s.__startMs) && Number.isFinite(s.__endMs))
    .filter((s) => s.__seconds >= 60)
    .filter((s, i, arr) => {
      const key = `${s.__startMs}|${s.__endMs}|${s.__seconds}|${s.__manual ? 1 : 0}`;
      return (
        arr.findIndex((x) => {
          const compareKey = `${x.__startMs}|${x.__endMs}|${x.__seconds}|${x.__manual ? 1 : 0}`;
          return compareKey === key;
        }) === i
      );
    });

  const collapseNearbyDup = (arr) => {
    const sorted = arr.slice().sort((a, b) => a.__startMs - b.__startMs);

    return sorted.filter((s, idx) => {
      if (idx === 0) return true;

      const prev = sorted[idx - 1];
      const sameSec = s.__seconds === prev.__seconds;
      const near = Math.abs(s.__startMs - prev.__startMs) <= 10000;

      return !(sameSec && near);
    });
  };

  const manualSessions = collapseNearbyDup(
    normalizedDaySessions.filter((s) => s.__manual)
  );

  const eventSessions = collapseNearbyDup(
    normalizedDaySessions.filter((s) => s.__source === "camera_event")
  );

  const allVisibleSessions = [...manualSessions, ...eventSessions].sort(
    (a, b) => a.__startMs - b.__startMs
  );

  const totalSeconds = allVisibleSessions.reduce(
    (sum, s) => sum + s.__seconds,
    0
  );

  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMins = Math.floor((totalSeconds % 3600) / 60);
const timeStr =
  String(totalHours).padStart(2,"0") +
  ":" +
  String(totalMins).padStart(2,"0");
  const renderSessionCard = (s)=>{

const start=new Date(s.__startMs);
const end=new Date(s.__endMs);

const startStr=start.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});
const endStr=end.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});

const mins=Math.floor(s.__seconds/60);

return`


<div class="session-time">
${startStr} ~ ${endStr}
</div>

<div class="session-min">
${mins}분
</div>


`;
};

  const dayRecords = baseRecords.filter((r) => {
    const ts = r?.timestamp || r?.createdAt || r?.date;
    const t = new Date(ts).getTime();
    return Number.isFinite(t) && t >= dayStart && t < dayEnd;
  });

  const recordHtml = dayRecords.length
    ? dayRecords
        .map((r) => {
          const ts = new Date(r?.timestamp || r?.createdAt || r?.date);

          const timeStr = Number.isFinite(ts.getTime())
            ? ts.toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-";

          const tags =
            Array.isArray(r?.subjects) && r.subjects.length
              ? r.subjects
              : [r?.subject].filter(Boolean);

          const tagHtml = tags
            .map((t) => `<span class="day-record-tag">#${t}</span>`)
            .join("");

          return `
            <div class="day-record-card">
              <div class="day-record-top">
                <div class="day-record-tags">${tagHtml}</div>
                <span class="day-record-time">${timeStr}</span>
              </div>
              <div class="day-record-content">${r?.content || ""}</div>
            </div>
          `;
        })
        .join("")
    : `<div class="day-empty">📑 기록 없음</div>`;

 const visibleSessions = expanded 
? allVisibleSessions : allVisibleSessions.slice(0, 3); 
const toggleButtonHtml = allVisibleSessions.length > 3 ?
 ` 
<button type="button" class="session-toggle-btn" 
onclick="window.toggleDaySessionExpand('${dayKey}')" >
 ${expanded ? "접기" : `${allVisibleSessions.length - 3}개 더보기`} </button>
 ` : ""; const sessionHtml = allVisibleSessions.length ? ` 

<section class="day-section"> 
<div class="day-section-title">
Session (${allVisibleSessions.length})
</div> 

<div class="day-session-list"> 
${visibleSessions.map(renderSessionCard).join("")} 
</div>

 ${toggleButtonHtml} 
</section> 

` : `

<section class="day-section"> 

<div class="day-empty">
세션 기록 없음
</div> 

</section> `;
   

  detailDiv.innerHTML=`
 



<div class="calendar-detail-head">

<strong class="calendar-detail-date">
${year}/${month+1}/${day}
</strong>

<span class="calendar-detail-summary">
${timeStr}
</span>

</div>

<div class="day-session-list">
${visibleSessions.map(renderSessionCard).join("")}
</div>

<section class="day-section">

<div class="day-section-title">
Study Note
</div>

${recordHtml}

</section>


`;

  detailDiv.classList.add("show");
};





window.initMemoEditor = function(){

const editor = document.getElementById("memoEditor");
if(!editor) return;

editor.addEventListener("input",(e)=>{

const value = e.target.value;

if(value.includes("#")){
const palette = document.getElementById("subjectPalette");
palette.classList.remove("hidden");
}

});

editor.addEventListener("keydown", (e) => {
  if (e.isComposing || e.key !== "Enter") return;

  const text = editor.value || "";
  const match = text.match(/#([^\s#]+)$/);
  if (!match) return;

  e.preventDefault();
  const subject = match[1];
  window.selectSubject(subject);
  editor.value = text.replace(/#([^\s#]+)$/, `#${subject} `);
});

};















window.checkGoalReward = function () {
  const goals = window.currentUser.freeGoals || [];
  const doneCount = goals.filter(g => g.done).length;

  if (doneCount >= 3 && !window.currentUser.goalBadge) {
  window.currentUser.goalBadge = true;
  alert("🎉 자유 목표 3개 달성!");

    // 뱃지 영역에 추가
    renderGoalBadge();
  }
};

window.renderGoalBadge = function () {
  const badgeBox = document.getElementById("badgeBox");
  if (!badgeBox) return;

  if (window.currentUser.goalBadge) {
    badgeBox.innerHTML += `
      <span class="badge">🏅 목표 달성왕</span>
    `;
  }
};

window.renderGoalResultWidget = function () {

const user = window.currentUser;
  if (!user) return;

  const goals = user.freeGoals || [];
const doneCount = goals.filter(g => g.done).length;
const percent = goals.length
  ? Math.floor((doneCount / goals.length) * 100)
  : 0;

if (percent >= 100) {
  document.body.classList.add("goal-complete");
}

  document.getElementById("miniFreeGoalStatus").innerHTML =
    doneCount >= 3
      ? `🏅 ${doneCount}개 달성!`
      : `${doneCount}/${goals.length} 완료`;

}

window.renderTimeGoal = function() {
  const box = document.getElementById("timeGoalBox");
  if (!box) return;

const user = window.currentUser;
  if (!user) return;

  const goalHours = user.monthGoalHours || 40;

  const monthSeconds = window.getMonthSeconds(user);
  const currentHours = monthSeconds / 3600;

  const percent = Math.min(
    100,
    Math.floor((currentHours / goalHours) * 100)
  );

 box.innerHTML = `
  <div class="time-goal-text">
    ${goalHours}시간 중 ${currentHours.toFixed(1)}시간
  </div>

  <div class="goal-bar">
    <div class="goal-bar-fill" style="width:${percent}%"></div>
  </div>

  <div class="goal-percent">${percent}%</div>
`;
};

window.saveUserData = async function () {

  if (!window.currentUserId) return;

  try {

    const res = await fetch("/save-user-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: window.currentUserId,
        freeGoals: window.currentUser.freeGoals,
        studyRecords: window.currentStudyRecords
      })
    });

    if (!res.ok) {
      throw new Error("서버 응답 오류");
    }

    console.log("저장 완료");

  } catch (e) {
    console.error("저장 실패", e);
  }
};

window.renderWeeklyGoalCompare = function(user){

const el = document.getElementById("weeklyStatusText");
if(!el) return;

const goal = user.monthGoalHours || 40;

const current = user.totalSeconds / 3600;

const now = new Date();
const days = new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
const today = now.getDate();

const expected = (goal/days)*today;

const diff = current - expected;

const text =
diff>=0
? `+${diff.toFixed(1)}h 앞서가는 중 🚀`
: `${Math.abs(diff).toFixed(1)}h 부족 ⚠`;

el.innerHTML = `
<div class="weekly-status ${diff>=0?'good':'bad'}">
${text}
</div>
`;

};




window.toggleGoal = function(index) {
  if (typeof window.toggleFreeGoal === "function") {
    window.toggleFreeGoal(index);
  }
};



window.toggleDarkMode = function () {
  document.body.classList.toggle("dark");
};



window.getBadges = function(user) {

  const badges = [];

  const baseSessions = window.getAggregateSessionList(
    Array.isArray(user?.sessions) ? user.sessions : []
  );
  const monthHours = window.getMonthlyHoursFromSessions(baseSessions);

if (monthHours >= 5)  badges.push("📚 5시간 달성");
if (monthHours >= 20) badges.push("💪 20시간 달성");
if (monthHours >= 50) badges.push("👑 50시간 달성");
if (user?.goalBadge) badges.push("🏅 목표 달성왕");

  return badges;
};

window.renderMonthlySummary = function() {

  const box = document.getElementById("monthlySummary");
  if (!box || !window.currentUser) return;

  const user = window.currentUser;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const monthStart = new Date(year, month, 1, 0,0,0,0).getTime();
  const monthEnd   = new Date(year, month + 1, 1, 0,0,0,0).getTime();

  let totalSeconds = 0;

  const baseSessions = window.getAggregateSessionList(user.sessions || []);
  baseSessions.forEach(s => {

    const start = window.normalizeTime(s.start);
    let end   = window.normalizeTime(s.end);
    const sec = Number(s?.seconds || 0);

    if (!start) return;
    if (!end || end <= start) {
      if (Number.isFinite(sec) && sec > 0) {
        end = start + sec * 1000;
      } else {
        return;
      }
    }

    totalSeconds += window.getOverlapSeconds(
      start,
      end,
      monthStart,
      monthEnd
    );
  });

  const totalMinutes = Math.floor(totalSeconds / 60);
 const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  box.innerHTML = `
    📊 이번 달 총 공부 시간<br>
    ${hours}시간 ${mins}분
  `;
};

window.getStreakFromSessions = function(sessions = []) {

  let streak = 0;
  const now = new Date();

  for (let i = 0; i < 365; i++) {

    const d = new Date(now);
    d.setDate(now.getDate() - i);

    const sec = window.getDayStudySeconds(
      sessions,
      d.getFullYear(),
      d.getMonth(),
      d.getDate()
    );

    if (sec > 0) streak++;
    else break;
  }

  return streak;
};



window.getMonthSeconds = function(user) {

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  let total = 0;

  (user.sessions || []).forEach(s => {

    const start = window.normalizeTime(s.start);
    const end   = window.normalizeTime(s.end);

    if (!start || !end) return;

    total += window.getOverlapSeconds(
      start,
      end,
      monthStart,
      monthEnd
    );

  });

  return total;
};

window.normalizeTime = function(t) {
  if (!t) return 0;
  if (typeof t === "number") return t;
  return new Date(t).getTime();
};


window.getOverlapSeconds = function(start, end, rangeStart, rangeEnd) {

  const overlapStart = Math.max(start, rangeStart);
  const overlapEnd   = Math.min(end, rangeEnd);

  if (overlapEnd <= overlapStart) return 0;

  return (overlapEnd - overlapStart) / 1000; // 초만 반환
};


window.getDayRange = function(year, month, day) {
  const start = new Date(year, month, day, 0,0,0,0).getTime();
  const end   = new Date(year, month, day + 1, 0,0,0,0).getTime();
  return { start, end };
};



window.renderRealUI = function(user) {
  const view = document.getElementById("view");

  view.innerHTML = `
    <div class="mypage-card">
      <h2>${user.nickname}</h2>
      <div>총 공부 시간: ${(user.totalSeconds/3600).toFixed(1)}h</div>
    </div>
  `;
window.renderSubjectPalette();
};

window.addStudyRecord = function() {

  if (!window.selectedSubject) return;

const input = document.getElementById("recordInput");
  if (!input) return;

  if (!input.value.trim()) return;

input.addEventListener("keydown", function(e) {

  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    window.addStudyRecord();
  }

});

 const selectedSubject =
  document.getElementById("selectedSubjectText").innerText;

const record = {
  subject: selectedSubject,
  content: input.value,
  createdAt: Date.now(),
  type: "manual"
};

  if (!window.currentStudyRecords) {
    window.currentStudyRecords = [];
  }

  window.currentStudyRecords.unshift(record);

  input.value = "";

localStorage.setItem(
  `records_${window.currentUserId}`,
  JSON.stringify(window.currentStudyRecords)
);
  window.renderStudyRecords();
  window.autoSaveRecords();
};

window.formatDateFull = function(year, month, day) {

  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  return `${year}/${mm}/${dd} 00:00`;
};

window.autoSaveRecords = async function() {

  if (!window.currentUserId) return;

  try {
    await fetch("/save-records", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: window.currentUserId,
        studyRecords: window.currentStudyRecords
      })
    });

  } catch (err) {
    console.error("자동저장 실패", err);
  }
};







window.renderSubjectSummary = function() {

  const container = document.getElementById("subjectSummary");
  if (!container) return;

  const summary = {};

  window.currentStudyRecords.forEach(r => {
    if (!summary[r.subject]) summary[r.subject] = 0;

    const match = r.content.match(/(\d+)분/);
    if (match) {
      summary[r.subject] += parseInt(match[1]);
    }
  });

  container.innerHTML = Object.keys(summary).map(subject => {

    const color = window.generateTagColor(subject);

    return `
      <div class="subject-card"
           style="border-left:4px solid ${color.border}">
        <span>${subject}</span>
        <strong>${summary[subject]}분</strong>
      </div>
    `;
  }).join("");
};


window.onTimerEnd = function(subject, minutes) {

const selectedSubject =
  document.getElementById("selectedSubjectText").innerText;

const record = {
  subject: selectedSubject,
  content: input.value,
  createdAt: Date.now()
};
  if (!window.currentStudyRecords) {
    window.currentStudyRecords = [];
  }

  window.currentStudyRecords.unshift(record);

  window.renderStudyRecords();
  window.autoSaveRecords();
};;

window.renderStudyRecords = function() {

  const list = document.getElementById("recordList");
  if (!list) return;

  list.innerHTML = window.currentStudyRecords.map(r => {

    const color = window.generateTagColor(r.subject);

    return `
      <div class="record-item">
        <span class="record-tag"
              style="
                background:${color.bg};
                color:${color.text};
                border:1px solid ${color.border};
              ">
          #${r.subject}
        </span>

       <span class="record-content"
  contenteditable="true"
  id="memo-editor"
  spellcheck="false"
      onblur="window.updateRecord(${r.id}, this.innerText)">
  ${r.content}
</span>
        <button class="record-delete"
                onclick="window.deleteRecord(${r.id})">
          ×
        </button>
      </div>
    `;
  }).join("");

};

window.updateRecord = function(id, newText) {

  const record = window.currentStudyRecords.find(r => r.id === id);
  if (!record) return;

  record.content = newText.trim();

  window.autoSaveRecords();
};


window.deleteRecord = function(id) {

  window.currentStudyRecords =
    window.currentStudyRecords.filter(r => r.id !== id);

  window.renderStudyRecords();
  window.autoSaveRecords();
};




// 태그 팝업 닫기 함수
window.closeTagPopup = function() {
    const popup = document.getElementById("tag-suggestions");
    if (popup) popup.style.display = "none";
};




// 1. # 입력 시 팝업 띄우는 함수
window.showTagDropdown = function(el) {
    const text = el.innerText;
    const popup = document.getElementById("tag-suggestions");
    const words = text.split(/\s/);
const lastWord = words[words.length - 1] || "";

// 🔥 '#' 하나만 쳐도 뜨게
if (lastWord.startsWith("#")) {
  popup.style.display = "grid";
} else {
  popup.style.display = "none";
}
};









// #태그 자동 변환 로직
window.handleTagTransform = function(el) {
    const content = el.innerHTML;
    // #단어 를 찾아서 태그 스팬으로 감싸는 간단한 정규식 (이미 변환된 것은 제외)
    if (content.includes('#')) {
        // 이 로직은 간단한 구현이며, 커서 위치 보정 등 디테일은 추후 보완 가능합니다.
        // 유저가 스페이스바를 누를 때 변환하는 방식이 가장 깔끔합니다.
    }
};












window.getStudyTimeByDay = function (sessions, day) {

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

const dayStart = new Date(year, month, day, 0,0,0,0).getTime();
const dayEnd   = new Date(year, month, day + 1, 0,0,0,0).getTime();

 

  return (totalSeconds / 3600).toFixed(1);
};

window.saveMemo = async function(text) {
  if (!window.currentUserId) return;

  await fetch("/save-memo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: window.currentUserId,
      memo: text
    })
  });
};







// 2. 새벽 4시 실시간 감시 타이머
window.startResetTimer = function (userId) {

  setInterval(() => {

    const now = new Date();

    if (now.getHours() === 4 && now.getMinutes() === 0) {

      if (window.currentStudyRecords) {

        const list = document.getElementById("recordList");

        if (list) {
          list.style.transition = "opacity 0.8s ease";
          list.style.opacity = "0";

          setTimeout(() => {
            window.currentStudyRecords = [];
            window.renderStudyRecords();
            list.style.opacity = "1";
            window.autoSaveRecords();
          }, 800);
        }

      }
    }

  }, 60000);

  saveData(data);
};

// 1. 메모장 렌더링 시 id="memo-editor"에 추가할 이벤트
window.setupMemoEditor = function(userId) {
  const editor = document.getElementById("memo-editor");
  if (!editor) return;

  editor.addEventListener('input', function(e) {
    const text = editor.innerText;
    const words = text.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('#')) {
      const query = lastWord.slice(1);
      // 추천 과목 팝업을 띄우는 로직 (예: "국어, 수학, 영어, 자습" 등 안내)
     
  }
})
  // 포커스가 나갈 때 서버에 저장하고 색깔 태그로 변환해서 보여줌
  editor.addEventListener('blur', function() {
    const rawText = editor.innerText;
    localStorage.setItem(`memo_${window.currentUserId}`, rawText); // 4시 리셋 대상
    editor.innerHTML = convertTextToTags(rawText);
  });
}

window.startTimer = function(minutes) {

  if (!window.selectedSubject) {
    alert("과목을 먼저 선택해줘");
    return;
  }

  window.currentTimerMinutes = minutes;
  window.timerSubject = window.selectedSubject;
window.onTimerEnd(window.selectedSubject, window.currentTimerMinutes);
  // 기존 타이머 로직...
};



// ====== TAG SYSTEM (GLOBAL) ======
window.SUBJECTS = ["국어", "한국사", "영어", "일본어", "중국어", "코딩", "컴활"];

// 과목별 클래스 매핑 (너가 준 CSS 그대로 사용)
window.getTagClass = function(tagText) {
  const map = {
    "국어": "tag-국어",
    "한국사": "tag-한국사",
    "영어": "tag-영어",
    "일본어": "tag-일본어",
    "중국어": "tag-중국어",
    "코딩": "tag-코딩",
    "컴활": "tag-컴활",
  };
  return map[tagText] || "tag-기타";
};






// 팝업 위치 예쁘게(에디터 기준으로 위에)
window.positionTagPopup = function() {
  const popup = document.getElementById("tag-suggestions");
  const editor = document.getElementById("memo-editor");
  if (!popup || !editor) return;

  // memo-container가 relative라면 left:0, bottom:100% 그대로 써도 됨
  // 혹시라도 깨질 때 대비해 width만 맞춰줌
  popup.style.width = "100%";
};

// 마지막 토큰(#으로 시작하는 단어) 가져오기
window.getLastToken = function(text) {
  const t = (text || "").replace(/\n/g, " ");
  const parts = t.split(/\s+/);
  return parts[parts.length - 1] || "";
};


window.handleMemoInput = function(el) {

  const text = el.innerText;
  const popup = document.getElementById("tag-suggestions");

  // empty 상태 처리
  if (text.trim().length === 0) {
    el.classList.add("empty");
  } else {
    el.classList.remove("empty");
  }

  if (!popup) return;

  // 마지막 단어 확인
  const parts = text.replace(/\n/g, " ").split(/\s+/);
  const lastWord = parts[parts.length - 1] || "";

  // '#' 입력 중일 때만 팝업 표시
  if (lastWord.startsWith("#")) {
    popup.style.display = "grid";
  } else {
    popup.style.display = "none";
  }
};


// ✨ 스페이스/엔터 키로 태그 변환 (한글 IME 대응)
window.handleMemoKeydown = function(e) {

  if (e.isComposing) return;

  if (e.key === "Enter") {

    const el = e.target;
    const text = el.innerText;

    const match = text.match(/#([ㄱ-ㅎㅏ-ㅣ가-힣a-zA-Z0-9]+)$/);

    if (match) {

      e.preventDefault();

      const newText = text + " ";

      el.innerHTML = window.convertTextToTags(newText);
      window.placeCaretAtEnd(el);

      window.closeTagPopup();
      window.saveMemoToServer(el.innerText);
    }
  }
};

window.handleCompositionEnd = function(e) {
    // 한글 입력이 완료되었을 때만 실행
    setTimeout(() => {
        window.handleMemoInput(e.target);
    }, 0);
};


window.saveMemoAndRender = function(el) {
    const rawText = el.innerText.trim();
    
    if (!rawText) return;
    
    // 서버에 순수 텍스트만 저장
    window.saveMemoToServer(rawText);
    
    // 화면에는 태그로 변환해서 표시
    const converted = window.convertTextToTags(rawText);
    el.innerHTML = converted;
};


window.convertTextToTags = function(text) {

  if (!text) return "";

  const plainText = text.replace(/×/g, "");

  let result = "";
  let lastIndex = 0;

  const regex = /#([ㄱ-ㅎㅏ-ㅣ가-힣a-zA-Z0-9]+)/g;
  let match;

  while ((match = regex.exec(plainText)) !== null) {

    const fullMatch = match[0];
    const tagName = match[1];
    const matchIndex = match.index;

    result += plainText.substring(lastIndex, matchIndex);

   const colors = window.generateTagColor(tagName);

result += `
  <span class="tag-badge"
        contenteditable="false"
        style="
          background:${colors.bg};
          color:${colors.text};
          border:1px solid ${colors.border};
        ">
    ${fullMatch}
    <span class="tag-close" onclick="window.removeTag(this)">×</span>
  </span> `;

    lastIndex = regex.lastIndex;
  }

  result += plainText.substring(lastIndex);
  return result;
};




window.addSubjectTag = function(subject) {

  const editor = document.getElementById("memo-editor");
  const popup = document.getElementById("tag-suggestions");
  if (!editor) return;

  const text = editor.innerText.trim();

  // 마지막에 #가 있으면 제거
  const cleanedText = text.replace(/#$/, "");

  const newText = cleanedText + "#" + subject + " ";

  editor.innerHTML = window.convertTextToTags(newText);
  window.placeCaretAtEnd(editor);

  if (popup) popup.style.display = "none";

  window.saveMemoToServer(editor.innerText);
};

window.removeTag = function(closeBtn) {
    const editor = document.getElementById("memo-editor");
    const tagBadge = closeBtn.parentElement;
    
    if (tagBadge) {
        tagBadge.remove();
        
        // 변경사항 저장
        if (editor) {
            window.saveMemoToServer(editor.innerText);
        }
    }
};


// ===== 시간 목표 렌더링 =====
window.renderTimeGoal = function(user) {
  const goalBox = document.getElementById('timeGoalBox');
  if (!goalBox) return;
  
  const goalSec = user.goalSec || 0;
  const totalSec = user.totalSeconds || 0;
  
  if (goalSec === 0) {
    goalBox.innerHTML = `
     <div class="goal-empty">

<div class="goal-empty-icon">🎯</div>

<div class="goal-empty-text">
이번 달 목표를 설정해보세요
</div>

<div class="goal-empty-sub">
디스코드에서 <code>!goal 40h</code>을 통해 목표시간을 설정해보세요!
</div>

</div>
    `;
    return;
  }
  
  const goalHours = Math.floor(goalSec / 3600);
  const currentHours = (totalSec / 3600).toFixed(1);
  const percentage = Math.min((totalSec / goalSec) * 100, 100).toFixed(0);
  const remaining = Math.max(goalSec - totalSec, 0);
  const remainingHours = (remaining / 3600).toFixed(1);
  
  goalBox.innerHTML = `
    <div class="goal-progress-container">
      <div class="goal-stats">
        <div class="goal-stat">
          <span class="goal-stat-label">달성</span>
          <span class="goal-stat-value">${currentHours}h</span>
        </div>
        <div class="goal-stat">
          <span class="goal-stat-label">목표</span>
          <span class="goal-stat-value">${goalHours}h</span>
        </div>
        <div class="goal-stat">
          <span class="goal-stat-label">남음</span>
          <span class="goal-stat-value">${remainingHours}h</span>
        </div>
      </div>
      
      <div class="progress-bar-wrapper">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${percentage}%">
            <span class="progress-percentage">${percentage}%</span>
          </div>
        </div>
      </div>
      
      ${percentage >= 100 ? `
        <div class="goal-achievement">
          🎉 목표 달성! 축하합니다!
        </div>
      ` : ''}
    </div>
  `;
};

// ===== 주간 진행률 렌더링 =====
window.renderWeeklyStatus = function(user) {
  const weeklyBox = document.getElementById('weeklyStatusText');
  if (!weeklyBox) return;
  
  const sessions = user.sessions || [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // 이번 주 세션만 필터
  const weekSessions = sessions.filter(s => {
    const sessionDate = new Date(s.start);
    return sessionDate >= weekAgo && sessionDate <= now;
  });
  
  const weekTotal = weekSessions.reduce((sum, s) => sum + (s.seconds || 0), 0);
  const weekHours = (weekTotal / 3600).toFixed(1);
  const dailyAvg = (weekTotal / 7 / 3600).toFixed(1);
  
  // 일별 분포 계산
  const dailyData = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStr = day.toDateString();
    const daySeconds = weekSessions
      .filter(s => new Date(s.start).toDateString() === dayStr)
      .reduce((sum, s) => sum + (s.seconds || 0), 0);
    
    dailyData.push({
      date: day.getDate(),
      hours: (daySeconds / 3600).toFixed(1),
      percentage: Math.min((daySeconds / 14400) * 100, 100) // 4시간 기준
    });
  }
  const weeklyTarget = 28; // 주 28시간 기준
const progress = Math.min((weekHours / weeklyTarget) * 100,100).toFixed(0);
const statusText = progress >= 100
  ? "🔥 목표 달성!"
  : `🚀 ${progress}% 진행 중`;

 weeklyBox.innerHTML = `

<div class="weekly-summary">

  <div class="weekly-kpi">
    <div class="weekly-main">${weekHours}h</div>
    <div class="weekly-sub">이번 주 공부 시간</div>
  </div>

  <div class="weekly-status">
    ${statusText}
  </div>

  <div class="weekly-progress">
    <div class="weekly-progress-bar">
      <div class="weekly-progress-fill" style="width:${progress}%"></div>
    </div>
    <div class="weekly-progress-text">
      ${progress}% 달성
    </div>
  </div>

  <div class="weekly-stats">

    <div class="weekly-stat">
      <span class="weekly-stat-value">${dailyAvg}h</span>
      <span class="weekly-stat-label">하루 평균</span>
    </div>

    <div class="weekly-stat">
      <span class="weekly-stat-value">${weekSessions.length}</span>
      <span class="weekly-stat-label">세션 수</span>
    </div>

  </div>

  <div class="weekly-chart">

    ${dailyData.map(d => `
      <div class="chart-bar">
        <div class="chart-bar-fill" style="height:${d.percentage}%"></div>
        <span class="chart-bar-label">${d.date}</span>
      </div>
    `).join("")}

  </div>

</div>
`;
};


window.renderFreeGoals = function(){

const el=document.getElementById("freeGoalList");
if(!el) return;

const goals=window.currentUser.freeGoals||[];

el.innerHTML=`

<div class="free-goals-card">

<div class="goal-header">
<span class="goal-icon">✅</span>
<h3 class="goal-title">나만의 목표</h3>
</div>

<div class="free-goals-list">

${goals.length===0?`

<div class="goal-placeholder">

<div class="goal-placeholder-icon">📝</div>

<div class="goal-placeholder-text">
아직 목표가 없어요🥲
</div>

<div class="goal-placeholder-sub">
작은 목표부터 시작해보아요!
</div>

</div>

`:goals.map((goal,i)=>`

<div class="goal-row ${goal.done?"done":""}">

<button
class="goal-check"
onclick="window.toggleFreeGoal(${i})"
>
${goal.done?"✔":""}
</button>

<span class="goal-text">
${goal.text}
</span>

<button
class="goal-delete"
onclick="window.removeFreeGoal(${i})"
>
✕
</button>

</div>

`).join("")}

</div>

<div class="goal-list"></div>

<div class="goal-input-area">
  <button
    class="goal-add-trigger"
    onclick="window.openGoalInput()"
  >
    + 목표 추가
  </button>
</div>

</div>

`;

};


window.renderStudyRecords = function () {
  if (typeof window.renderRecordList === "function") {
    window.renderRecordList();
  }
};

window.deleteRecord = function (recordId) {
  const userId = window.currentUserId;
  const raw = JSON.parse(localStorage.getItem(`records_${userId}`) || "[]");
  const records = Array.isArray(raw) ? raw : [];
  const filtered = records.filter((r) => String(r?.id) !== String(recordId));
  localStorage.setItem(`records_${userId}`, JSON.stringify(filtered));
  window.currentStudyRecords = filtered;

  if (typeof window.renderRecordList === "function") {
    window.renderRecordList();
  }

  if (typeof window.autoSaveRecords === "function") {
    window.autoSaveRecords();
  }
};

// ===== 자유 목표 토글 =====
window.toggleFreeGoal = async function(index) {
  const user = window.currentUser;
  if (!user || !user.freeGoals) return;
  
  user.freeGoals[index].done = !user.freeGoals[index].done;
  
  
  window.renderFreeGoals();
  if (typeof window.saveUserData === "function") {
    window.saveUserData();
  }
};

// ===== 자유 목표 추가 =====
window.addFreeGoal = async function() {
  const input = document.getElementById('newGoalInput');
  if (!input || !input.value.trim()) return;
  
  const user = window.currentUser;
  if (!user) return;
  
  if (!user.freeGoals) user.freeGoals = [];
  
  user.freeGoals.push({
    text: input.value.trim(),
    done: false,
    createdAt: new Date().toISOString()
  });
  
  
  input.value = '';
  window.renderFreeGoals();
  if (typeof window.saveUserData === "function") {
    window.saveUserData();
  }
};

// ===== 자유 목표 제거 =====
window.removeFreeGoal = async function(index) {
  const user = window.currentUser;
  if (!user || !user.freeGoals) return;
  
  user.freeGoals.splice(index, 1);
  
  
  window.renderFreeGoals();
  if (typeof window.saveUserData === "function") {
    window.saveUserData();
  }
};





window.placeCaretAtEnd = function(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
};

window.getDayStudySeconds = function(sessions = [], year, month, day) {

  if (!Array.isArray(sessions)) return 0;
  const baseSessions = sessions;

  const { start, end } = window.getDayRange(year, month, day);

  let total = 0;

  for (const s of baseSessions) {

    const sStart = window.normalizeTime(s.start);
    let sEnd   = window.normalizeTime(s.end);
    const sec = Number(s?.seconds || 0);

    if (!sStart) continue;
    if (!sEnd || sEnd <= sStart) {
      if (Number.isFinite(sec) && sec > 0) {
        sEnd = sStart + sec * 1000;
      } else {
        continue;
      }
    }

    total += window.getOverlapSeconds(
      sStart,
      sEnd,
      start,
      end
    );
  }

  return total;
};
