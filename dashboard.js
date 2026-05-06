const STORAGE_KEY = "mahjong_poc_progress_v1";
const QUESTION_BANK_FILES = ["questions.json", "questions.generated.json"];

function resolveQuestionBankFile() {
  const name = new URLSearchParams(location.search).get("bank");
  if (name && QUESTION_BANK_FILES.includes(name)) {
    return name;
  }
  return "questions.json";
}

function buildPlayHref(questionId) {
  const params = new URLSearchParams();
  const bank = new URLSearchParams(window.location.search).get("bank");
  if (bank && QUESTION_BANK_FILES.includes(bank)) params.set("bank", bank);
  params.set("q", questionId);
  return `./play.html?${params.toString()}`;
}

function buildPlayModeHref(mode, fallbackQuestionId) {
  const params = new URLSearchParams();
  const bank = new URLSearchParams(window.location.search).get("bank");
  if (bank && QUESTION_BANK_FILES.includes(bank)) params.set("bank", bank);
  if (mode && mode !== "all") params.set("mode", mode);
  if (fallbackQuestionId) params.set("q", fallbackQuestionId);
  return `./play.html?${params.toString()}`;
}

function statusForAttempts(attempts) {
  if (!attempts || attempts.length === 0) return { label: "未作答", className: "status-none" };
  const correct = attempts.filter((a) => a.isCorrect).length;
  const wrong = attempts.length - correct;
  if (wrong === 0) return { label: "全對", className: "status-ok" };
  if (correct === 0) return { label: "曾答錯", className: "status-bad" };
  return { label: `對${correct}/錯${wrong}`, className: "status-mix" };
}

async function loadQuestions() {
  const file = resolveQuestionBankFile();
  const labelEl = document.getElementById("bank-label");
  if (labelEl) labelEl.textContent = file;

  const url = `./data/${file}`;
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    throw new Error(
      "請勿用檔案總管雙擊開啟頁面。請在 mahjong-tile-efficiency-poc 資料夾內跑 python -m http.server，再用瀏覽器開 http://127.0.0.1:8765/index.html"
    );
  }

  let response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (e) {
    throw new Error(`無法載入 ${url}。請確認本機 HTTP server 的根目錄是 mahjong-tile-efficiency-poc。（${String(e instanceof Error ? e.message : e)}）`);
  }
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}：server 目錄錯誤或檔案不存在`);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`${url} JSON 解析失敗`);
  }
  const questions = data.questions || [];
  return normalizeQuestionsFromBank(questions);
}

function normalizeQuestionsFromBank(questions) {
  const defaults = {
    q5: { prompt: "有4枚中呢，可以暗槓哦", choices: ["槓", "不槓（改打7m）"] },
    q6: { prompt: "還是東1局 第8巡 東家 dora還是9p跟南", choices: ["打7m立直", "默聽"] },
  };
  return questions.map((q) => {
    if (q.type !== "choice") return q;
    const d = defaults[q.id];
    if (!d) return q;
    return {
      ...q,
      prompt: q.prompt || d.prompt,
      choices: q.choices && q.choices.length ? q.choices : d.choices,
    };
  });
}

function normalizeDashboardState(parsed) {
  const s = parsed && typeof parsed === "object" ? parsed : {};
  return {
    attempts: s.attempts && typeof s.attempts === "object" ? s.attempts : {},
    notes: s.notes && typeof s.notes === "object" ? s.notes : {},
    studyFlags: s.studyFlags && typeof s.studyFlags === "object" ? s.studyFlags : {},
    overrides: s.overrides && typeof s.overrides === "object" ? s.overrides : {},
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return normalizeDashboardState(null);
  try {
    return normalizeDashboardState(JSON.parse(raw));
  } catch {
    return normalizeDashboardState(null);
  }
}

function attemptSummaryForDashboard(questionId, attemptsArr) {
  const attempts = [...(attemptsArr || [])];
  attempts.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  const everCorrect = attempts.some((a) => a.isCorrect);
  let lastWrongISO = null;
  for (let i = attempts.length - 1; i >= 0; i -= 1) {
    const a = attempts[i];
    if (!a.isCorrect && lastWrongISO == null) lastWrongISO = a.timestamp;
  }
  return { everCorrect, lastWrongISO, attemptCount: attempts.length };
}

function formatShortWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function applyBankPatchesDashboard(questions, bankFile, overridesRoot) {
  const patchMap = overridesRoot?.[bankFile];
  if (!patchMap || typeof patchMap !== "object") return questions;
  return questions.map((q) => {
    const p = patchMap[q.id];
    if (!p || typeof p !== "object") return q;
    const next = { ...q };
    Object.keys(p).forEach((k) => {
      if (p[k] !== undefined) next[k] = p[k];
    });
    return next;
  });
}

async function initDashboard() {
  const tbody = document.getElementById("question-index-body");
  const errEl = document.getElementById("dashboard-error");
  const summaryEl = document.getElementById("summary-line");
  const homeLink = document.getElementById("link-play-home");

  summaryEl.textContent = "";

  try {
    const bankFile = resolveQuestionBankFile();
    const rawList = await loadQuestions();
    const state = loadState();
    const questions = applyBankPatchesDashboard(rawList, bankFile, state.overrides);

    if (homeLink && questions.length > 0) {
      homeLink.href = buildPlayHref(questions[0].id);
    }
    const attemptsAll = Object.values(state.attempts).flat();
    const correctAll = attemptsAll.filter((a) => a.isCorrect).length;
    const wrongQuestionIds = questions
      .filter((q) => (state.attempts[q.id] || []).some((a) => !a.isCorrect))
      .map((q) => q.id);
    const firstWrong = wrongQuestionIds[0] || questions[0]?.id;
    summaryEl.innerHTML = `題庫：${resolveQuestionBankFile()}｜總作答 ${attemptsAll.length} 次｜答對 ${correctAll} 次｜` +
      `<a href="${buildPlayModeHref("daily10", questions[0]?.id)}">每日隨機10題</a>｜` +
      `<a href="${buildPlayModeHref("wrongRandom", firstWrong)}">歷史錯題隨機（${wrongQuestionIds.length}）</a>`;

    tbody.innerHTML = questions
      .map((q) => {
        const attempts = state.attempts[q.id] || [];
        const st = statusForAttempts(attempts);
        const playUrl = buildPlayHref(q.id);
        const h = attemptSummaryForDashboard(q.id, attempts);
        const starred = Boolean(state.studyFlags?.[q.id]);
        const wrongWhen = formatShortWhen(h.lastWrongISO);
        return `
        <tr>
          <td>${starred ? '<span class="small-star" title="複習標記">★</span>' : ""}<a href="${playUrl}">${q.title}</a></td>
          <td>${q.type === "choice" ? "選項" : "打牌"}</td>
          <td><span class="status-badge ${st.className}">${st.label}</span></td>
          <td>${attempts.length}</td>
          <td>${h.everCorrect ? "是" : "否"}</td>
          <td>${wrongWhen}</td>
          <td><a href="${playUrl}">練習</a></td>
        </tr>`;
      })
      .join("");
  } catch (e) {
    errEl.textContent = String(e);
    errEl.classList.remove("hidden");
  }
}

initDashboard();
