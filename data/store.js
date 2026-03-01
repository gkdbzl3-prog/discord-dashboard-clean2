// data/store.js
const fs = require('fs');
const path = require('path');
const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      // 파일 없으면 기본 구조 생성
      return { users: {}, feed: [] };
    }

    const content = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(content);

  } catch (e) {
    console.error('[loadData]', e);
    return { users: {}, feed: [] };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log("✅ data.json 저장 완료!");
  } catch (err) {
    console.error("❌ 파일 저장 중 에러:", err);
  }
}

module.exports = { loadData, saveData, DATA_FILE };
