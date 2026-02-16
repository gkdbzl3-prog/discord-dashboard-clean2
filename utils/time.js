


function kstDateKeyFromMs(ms) {


  if (!Number.isFinite(ms)) {
    throw new Error(`kstDateKeyFromMs: invalid ms = ${ms}`);
  }

  return new Intl.DateTimeFormat(
    'en-CA',
    { timeZone: 'Asia/Seoul' }
  ).format(new Date(ms));
}

function kstStartOfTodayMs(nowMs = Date.now()) {
   
  const daykey = kstDateKeyFromMs(nowMs);
  return Date.parse(`${daykey}T00:00:00.000Z`) - 9 * 60 * 60 * 1000;
}


function kstStartOfWeekMs(nowMs = Date.now()) {
  const todayStart = kstStartOfTodayMs(nowMs);
  const kstNow = nowMs + 9 * 60 * 60 * 1000;
  const kstDay = new Date(kstNow).getUTCDay(); // 0=일,1=월...
  const diffToMonday = (kstDay === 0 ? 6 : kstDay - 1); // 월요일 시작
  return todayStart - diffToMonday * 24 * 60 * 60 * 1000;
}

function overlapSeconds(s, e, start, end) {
  return Math.max(0, Math.min(e, end) - Math.max(s, start)) / 1000;
} 



function formatSeconds(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}시간 ${m}분`;
}

function daysInMonth(y, m) {
return new Date(y, m, 0).getDate();
}

function firstDowKst(y, m) {
 const day = `${y}-${String(m).padStart(2,'0')}-01`;
  const utcMidnightMs = Date.parse(`${daykey}T00:00:00.000Z`);
  const kstMs = utcMidnightMs - 9*60*60*1000; // KST 00:00
  const kstNow = kstMs + 9*60*60*1000;
  return new Date(kstNow).getUTCDay();
}


function makeSimpleAttendanceRow(attDays, nowMs = Date.now()) {
  const daykey = kstDateKeyFromMs(nowMs); // 오늘
  const [y, m] = daykey.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const now = Date.now();
  const todayStart = kstStartOfTodayMs(now);
  const startDow = kstStartOfWeekMs(now);
  const dim = daysInMonth(y, m);
  const title = `🗓 ${y}-${String(m).padStart(2,'0')} 출석 달력`;
  const header = `일 월 화 수 목 금 토`;
  const today = Number(key.slice(-2));
let row = '';
  for (let d = 1; d <= today; d++) {
    const dayKey = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    if (attDays[dayKey]) {
      row += (d === today ? '🟪' : '🟩');
    } else {
      row += (d === today ? '🔷' : '⬜');
    }
  }
  return row;

}




module.exports = { kstDateKeyFromMs, kstStartOfTodayMs, 
    overlapSeconds,formatSeconds, 
     makeSimpleAttendanceRow, firstDowKst, daysInMonth};