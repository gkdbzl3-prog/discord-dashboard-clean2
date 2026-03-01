// mypage.js – 개인/공용 선택, 유저 선택, 닉네임 표시

if (!window.token) {
  window.token =
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem("adminToken");
}


window.generateTagColor = function(tagName) {
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // HSL 색상으로 변환 (밝기와 채도를 일정하게 유지)
    const h = Math.abs(hash % 360);
    const s = 65; // 채도 65%
    const l = 50; // 밝기 50%
    
    return `hsl(${h}, ${s}%, ${l}%)`;
};


const SUBJECTS = ["국어","한국사","영어","일본어","중국어","코딩","컴활"];






window.showMyPage = async function (userId) {

  console.log("Go to MyPage:", userId);

  document.body.classList.add("mypage");

  const view = document.getElementById("view");
  if (!view) return;

  const users = await window.API.fetch("/mypage");

  const user = data.find(u => u.id === userId);

  if (!user) {
    console.log("유저 못 찾음");
    return;
  }

const displayName = user.name || user.id;
const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

const avatarUrl =
  user?.avatar && user.avatar !== "null"
    ? user.avatar
    : DEFAULT_AVATAR;

  
  // 메모 초기화: 서버에서 가져온 텍스트를 태그로 변환
  const initialMemo = user.memo ? window.convertTextToTags(user.memo) : "";

  view.innerHTML = `
    <div style="max-width: 480px; width: 100%; margin: 0 auto; padding: 20px 10px;">
      <button onclick="window.showToday()"
        style="background:none; border:none; color:#555; cursor:pointer; margin-bottom:15px; font-size:12px;">
        ← Back
      </button>

      <div class="mypage-card">
     <img class="profile-avatar"
     src="${avatarUrl}"
     onerror="this.src='${DEFAULT_AVATAR}'">
<h2 class="profile-name">${displayName}</h2>

        <div class="mypage-block">
  <p class="mypage-block-title">
    ATTENDANCE
  </p>

          <div class="calendar-grid">
            ${Array.from({length: 28}, (_, i) => {
              const studyTime = getStudyTimeByDay(user.sessions || [], i + 1);
              const isAttended = parseFloat(studyTime) > 0;
              return `
                <div class="calendar-day ${isAttended ? 'attended' : ''}"
     data-detail="${studyTime}h">
                  <span class="calendar-date">${i + 1}</span>
                </div>
              `;
            }).join("")}
          </div>
        
<div class="section-divider"></div>
        <!-- ✅ MEMO -->
        <div class="memo-container">
          <p class="memo-label">STUDY NOTE</p>
          
          <div id="tag-suggestions" class="tag-popup">
            ${SUBJECTS.map(s => `<div class="subject-btn" onclick="window.addSubjectTag('${s}')">#${s}</div>`).join("")}
          </div>

          <div id="memo-editor"
     class="memo-editor ${(!user.memo || user.memo.trim() === '') ? 'empty' : ''}"
     contenteditable="true"
     oninput="window.handleMemoInput(this)"
     onkeyup="window.handleMemoKeyup(event)"
     onkeydown="window.handleMemoKeydown(event)"
     oncompositionend="window.handleCompositionEnd(event)"
     onblur="window.saveMemoAndRender(this)">${initialMemo}</div>
      </div>
    
  `;

  const palette = document.getElementById("tag-suggestions");
  if (palette) palette.style.display = "none";

document.body.classList.add("mypage");

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
    
    // 마지막 글자가 #이면 팝업 표시
    if (text.endsWith('#')) {
        popup.style.display = "grid";
        // 에디터 위치에 맞게 팝업 위치 조절 가능 (여기서는 고정 위치)
    } else {
        popup.style.display = "none";
    }
};






// 태그 처리 로직 (입력할 때마다 저장 및 변환 시도)
window.processTags = function(el, userId) {
    let content = el.innerText;
    
    // 로컬 스토리지 저장 (새벽 4시 리셋용)
    localStorage.setItem(`memoData_${user.name}`, content);
    localStorage.setItem(`memoDate_${user.name}`, new Date().toISOString());

    // 유저가 입력하기 편하도록 실시간 HTML 변환보다는 
    // 저장된 데이터를 불러올 때만 변환하거나, 시각적 가이드만 주는 게 좋습니다.
    // 여기서는 간단하게 #단어를 감지하는 로직만 둡니다.
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


window.setupAutocomplete = function(el) {
  el.addEventListener('keyup', (e) => {
    const text = el.innerText;
    const lastWord = text.split(/\s/).pop(); // 마지막 단어 추출

    // #으로 시작하면 자동완성 레이어 표시
    if (lastWord.startsWith('#')) {
      const query = lastWord.slice(1);
      const matches = SUBJECTS.filter(s => s.includes(query));
      
      if (matches.length > 0) {
        // 여기에 레이어를 띄우는 코드를 넣거나, 
        // 간단하게 알림창(혹은 미리보기 박스)으로 가이드만 줄 수 있습니다.
        console.log("추천 과목:", matches); 
      }
    }
    // 데이터 저장 (새벽 4시 리셋용)
    localStorage.setItem(`memo_${window.currentUserId}`, el.innerHTML);
  });
};











// 특정 날짜(day)의 총 공부 시간을 계산하는 함수
window.getStudyTimeByDay = function (sessions, day) {
  const targetDate = new Date();
  targetDate.setDate(day); // 현재 달의 'day'일로 설정
  const dateString = targetDate.toDateString();

  const daySeconds = sessions
    .filter(s => new Date(s.start).toDateString() === dateString)
    .reduce((sum, s) => sum + (s.duration || 0), 0);

  return (daySeconds / 3600).toFixed(1); // 시간 단위(h)로 반환
}



window.saveMemo = async function (userId) {
  const memoInput = document.getElementById("memo-" + userId);
  if (!memoInput) return;
  const memo = memoInput.value;

  try {
    const res = await fetch("/save-memo?token=" + encodeURIComponent(window.token), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, memo })
    });
    if (res.ok) alert("메모 저장 완료");
  } catch (e) {
    alert("메모 저장 실패");
  }
if (res.ok) {
  alert("메모 저장 완료");
  await window.loadUsers(); // 최신 데이터로 새로고침
}

}







// 2. 새벽 4시 실시간 감시 타이머
window.startResetTimer = function (userId) {
  setInterval(() => {
    const now = new Date();
    // 새벽 4시 정각 체크 (초 단위까지는 유연하게)
    if (now.getHours() === 4 && now.getMinutes() === 0) {
      const editor = document.getElementById("memo-editor");
      if (editor) {
        editor.style.transition = "opacity 1s ease";
        editor.style.opacity = "0"; // 슥 사라지는 효과
        setTimeout(() => {
          editor.innerHTML = "";
          editor.style.opacity = "1";
          localStorage.removeItem(`memo_${user.name}`);
        }, 1000);
      }
    }
  }, 60000); // 1분마다 체크
}

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
      console.log("Searching for:", query);
    }
  });

  // 포커스가 나갈 때 서버에 저장하고 색깔 태그로 변환해서 보여줌
  editor.addEventListener('blur', function() {
    const rawText = editor.innerText;
    localStorage.setItem(`memo_${user.name}`, rawText); // 4시 리셋 대상
    editor.innerHTML = convertTextToTags(rawText);
  });
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
    const isEmpty = el.innerText.trim().length === 0;
    
    if (isEmpty) {
        el.classList.add('empty');
    } else {
        el.classList.remove('empty');
    }

    const text = el.innerText;
    const popup = document.getElementById("tag-suggestions");
    
    // 마지막 단어만 체크
    const words = text.split(/\s/);
    const lastWord = words[words.length - 1] || "";

    // 입력 중인 #단어가 있으면 팝업 표시
    if (lastWord.startsWith("#") && lastWord.length > 1 && !lastWord.includes(' ')) {
        popup.style.display = "grid";
    } else {
        popup.style.display = "none";
    }
    
    // ✨ 실시간 태그 변환 (선택사항)
    // 만약 완성된 태그(# 뒤에 공백)가 있으면 즉시 변환
    const hasCompletedTag = /#([ㄱ-ㅎㅏ-ㅣ가-힣a-zA-Z0-9]+)\s/.test(text);
    if (hasCompletedTag && !el.querySelector('.tag-badge')) {
        const converted = window.convertTextToTags(text);
        el.innerHTML = converted;
        window.placeCaretAtEnd(el);
    }
};

window.handleMemoKeyup = function(e) {
    const el = e.target;
    
    // 스페이스나 엔터만 처리
    if (e.key === ' ' || e.key === 'Enter') {
        const text = el.innerText;
        
        // # 패턴이 있으면 변환 실행
        if (text.includes('#')) {
            // 현재 커서 위치 저장
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const cursorOffset = range.startOffset;
            
            // 변환 실행
            const converted = window.convertTextToTags(text);
            
            if (converted !== el.innerHTML) {
                el.innerHTML = converted;
                
                // 커서를 끝으로 이동
                window.placeCaretAtEnd(el);
                
                // 팝업 닫기
                const popup = document.getElementById("tag-suggestions");
                if (popup) popup.style.display = "none";
            }
        }
    }
};

// ✨ 스페이스/엔터 키로 태그 변환 (한글 IME 대응)
window.handleMemoKeydown = function(e) {
    const el = e.target;
    
    // 한글 조합 중이면 무시 (isComposing이 true면 한글 입력 중)
    if (e.isComposing) {
        return;
    }
    
    // 스페이스바 또는 엔터 키
    if (e.key === ' ' || e.key === 'Enter') {
        const text = el.innerText;
        const words = text.split(/\s/);
        const lastWord = words[words.length - 1];
        
        // 마지막 단어가 #으로 시작하면 변환
        if (lastWord && lastWord.startsWith('#') && lastWord.length > 1) {
            const tagName = lastWord.slice(1);
            
            // 최소 1글자 이상이면 태그로 인정
            if (tagName.length > 0) {
                e.preventDefault(); // 기본 동작 막기
                
                // 현재 텍스트에서 마지막 #단어 제거하고 스페이스 추가
                const beforeTag = text.slice(0, text.lastIndexOf(lastWord));
                const newText = beforeTag + lastWord + ' ';
                
                // HTML로 변환해서 렌더링
                el.innerHTML = window.convertTextToTags(newText);
                
                // 커서를 끝으로 이동
                window.placeCaretAtEnd(el);
                
                // 팝업 닫기
                const popup = document.getElementById("tag-suggestions");
                if (popup) popup.style.display = "none";
                
                // 저장
                window.saveMemoToServer(el.innerText);
            }
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

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;

    let plainText = (tempDiv.innerText || tempDiv.textContent || "")
        .replace(/×/g, "");

    let result = "";
    let lastIndex = 0;

    const regex = /#([ㄱ-ㅎㅏ-ㅣ가-힣a-zA-Z0-9]+)/g;
    let match;

    while ((match = regex.exec(plainText)) !== null) {
        const fullMatch = match[0];
        const tagName = match[1];
        const matchIndex = match.index;

        result += plainText.substring(lastIndex, matchIndex);

        const color = window.generateTagColor(tagName);

        const tagClass = window.getTagClass(tagName);

result += `
  <span class="tag-badge ${tagClass}"
        그냥="no-inline-style"
        contenteditable="false">
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

    const text = editor.innerText || "";
    const words = text.split(/\s/);
    const lastWord = words[words.length - 1] || "";

    let newText = text;
    
    // 마지막 단어가 #으로 시작하면 교체
    if (lastWord.startsWith("#")) {
        newText = text.slice(0, text.lastIndexOf(lastWord)) + "#" + subject + " ";
    } else {
        newText = text + "#" + subject + " ";
    }

    // 변환해서 표시
    editor.innerHTML = window.convertTextToTags(newText);
    window.placeCaretAtEnd(editor);
    
    if (popup) popup.style.display = "none";
    
    // 저장
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




window.placeCaretAtEnd = function(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
};

