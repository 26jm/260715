const STORAGE_KEY = "tutoring-helper-memos";
const API_ENDPOINT = "/api/generate";
const SESSION_KEY = "tutoring-helper-session";

const loginCard = document.getElementById("loginCard");
const loginForm = document.getElementById("loginForm");
const teacherName = document.getElementById("teacherName");
const teacherBirth = document.getElementById("teacherBirth");
const appContent = document.getElementById("appContent");
const logoutBtn = document.getElementById("logoutBtn");

const memoForm = document.getElementById("memoForm");
const memoList = document.getElementById("memoList");
const resultBox = document.getElementById("resultBox");
const resultView = document.getElementById("resultView");
const generateBtn = document.getElementById("generateBtn");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");

const lessonDate = document.getElementById("lessonDate");
const studentName = document.getElementById("studentName");
const progress = document.getElementById("progress");
const lessonMemo = document.getElementById("lessonMemo");

let memos = [];
let currentTeacher = loadSession();

init();

async function init() {
  if (!currentTeacher) {
    showLoggedOut();
    return;
  }

  showLoggedIn();
  memos = loadMemosFromLocalStorage();
  renderMemos();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = teacherName.value.trim();
  const birth = teacherBirth.value;
  if (!name || !birth) return;

  const teacherKey = await buildTeacherKey(name, birth);
  currentTeacher = { name, birth, teacherKey };
  localStorage.setItem(SESSION_KEY, JSON.stringify(currentTeacher));

  showLoggedIn();
  await init();
});

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  currentTeacher = null;
  memos = [];
  memoForm.reset();
  memoList.innerHTML = "";
  resultView.innerHTML = "";
  resultView.appendChild(resultBox);
  resultBox.textContent = "{}";
  showLoggedOut();
});

function showLoggedOut() {
  loginCard.hidden = false;
  appContent.hidden = true;
}

function showLoggedIn() {
  loginCard.hidden = true;
  appContent.hidden = false;
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

async function buildTeacherKey(name, birth) {
  const text = `${name.trim().toLowerCase()}|${birth}`;
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function loadMemosFromLocalStorage() {
  try {
    const scopedKey = `${STORAGE_KEY}:${currentTeacher.teacherKey}`;
    return JSON.parse(localStorage.getItem(scopedKey)) || [];
  } catch {
    return [];
  }
}

function saveMemosToLocalStorage() {
  const scopedKey = `${STORAGE_KEY}:${currentTeacher.teacherKey}`;
  localStorage.setItem(scopedKey, JSON.stringify(memos));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMemos() {
  if (!memos.length) {
    memoList.innerHTML = "<p class='format-note'>아직 저장된 메모가 없습니다. 첫 수업 메모를 추가해보세요.</p>";
    return;
  }

  memoList.innerHTML = memos
    .map(
      (memo) => `
        <article class="memo-item">
          <label class="memo-check">
            <input type="checkbox" class="memo-select" value="${memo.id}" />
            <span>선택</span>
          </label>
          <div class="memo-meta">
            <span><strong>${escapeHtml(memo.date)}</strong></span>
            <span>${escapeHtml(memo.studentName)}</span>
            <span>${escapeHtml(memo.progress)}</span>
          </div>
          <div class="memo-content">${escapeHtml(memo.memo)}</div>
        </article>
      `
    )
    .join("");
}

function getSelectedMemos() {
  const selectedIds = [...document.querySelectorAll(".memo-select:checked")].map((item) => item.value);
  return memos.filter((memo) => selectedIds.includes(memo.id));
}

function setResult(data, mode = "json") {
  if (mode === "cards") {
    renderResultCards(data);
    return;
  }

  resultView.innerHTML = "";
  resultBox.textContent = JSON.stringify(data, null, 2);
  resultView.appendChild(resultBox);
}

function renderResultCards(data) {
  const practiceItems = Array.isArray(data.next_class_practice) ? data.next_class_practice : [];

  resultView.innerHTML = `
    <div class="result-grid">
      <article class="result-card accent-card">
        <h3>학생용 카톡 메시지</h3>
        <p>${escapeHtml(data.student_message || "")}</p>
      </article>

      <article class="result-card">
        <h3>학부모용 리포트</h3>
        <p>${escapeHtml(data.parent_report || "")}</p>
      </article>

      <article class="result-card full-card">
        <h3>다음 수업용 문제와 해설</h3>
        <div class="practice-list">
          ${practiceItems
            .map(
              (item, index) => `
                <div class="practice-item">
                  <div class="practice-title">문제 ${index + 1}</div>
                  <div class="practice-question">${escapeHtml(item.question || "")}</div>
                  <div class="practice-answer">${escapeHtml(item.answer || "")}</div>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
    </div>
  `;
}

memoForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const nextMemo = {
    id: crypto.randomUUID(),
    teacherKey: currentTeacher.teacherKey,
    date: lessonDate.value,
    studentName: studentName.value.trim(),
    progress: progress.value.trim(),
    memo: lessonMemo.value.trim(),
    createdAt: new Date().toISOString(),
  };

  persistMemo(nextMemo);
});

async function persistMemo(nextMemo) {
  memos = [nextMemo, ...memos].sort((a, b) => b.date.localeCompare(a.date));
  saveMemosToLocalStorage();
  renderMemos();
  memoForm.reset();
  lessonDate.focus();
}

generateBtn.addEventListener("click", async () => {
  const selectedMemos = getSelectedMemos();

  if (!selectedMemos.length) {
    setResult({ error: "생성할 메모를 최소 1개 선택해주세요." });
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "생성 중...";

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ memos: selectedMemos }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "AI 응답 처리에 실패했습니다.");
    }

    setResult(data, "cards");
  } catch (error) {
    setResult({
      error: error.message,
      hint: "서버가 실행 중인지, GEMINI_API_KEY가 설정되어 있는지 확인하세요.",
    });
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "AI 통합 생성";
  }
});

clearSelectionBtn.addEventListener("click", () => {
  document.querySelectorAll(".memo-select").forEach((checkbox) => {
    checkbox.checked = false;
  });
});
