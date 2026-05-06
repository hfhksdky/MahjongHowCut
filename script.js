const STORAGE_KEY = "mahjong_poc_progress_v1";
let currentQuestionBankFile = "questions.json";
let QUESTIONS = [];
/** @type {any[]} cloned from fetch; overlays applied on rebuild */
let rawQuestionsBank = [];
let currentQuestionId = "q1";
const state = loadState();

const questionSectionEl = document.getElementById("question-section");
const questionFlagsCompactEl = document.getElementById("question-flags-compact");
const questionDetailEl = document.getElementById("question-detail");
const diagramWrapEl = document.getElementById("diagram-wrap");
const questionSelectEl = document.getElementById("question-select");
const btnPrevEl = document.getElementById("btn-prev");
const btnNextEl = document.getElementById("btn-next");
const btnPrevBottomEl = document.getElementById("btn-prev-bottom");
const btnNextBottomEl = document.getElementById("btn-next-bottom");
const practiceModeEl = document.getElementById("practice-mode");
const btnReshuffleEl = document.getElementById("btn-reshuffle");
const modeSummaryEl = document.getElementById("mode-summary");
const storageOriginHintEl = document.getElementById("storage-origin-hint");
const navHomeEl = document.getElementById("nav-home");
const actionTitleEl = document.getElementById("action-title");
const handTilesEl = document.getElementById("hand-tiles");
const choiceActionsEl = document.getElementById("choice-actions");
const resultSectionEl = document.getElementById("result-section");
const resultSummaryEl = document.getElementById("result-summary");
const answerLineEl = document.getElementById("answer-line");
const solutionTextEl = document.getElementById("solution-text");
const statsListEl = document.getElementById("stats-list");
const noteInputEl = document.getElementById("note-input");

const tileCorrectionFieldsEl = document.getElementById("tile-correction-fields");
const choiceCorrectionFieldsEl = document.getElementById("choice-correction-fields");
const corrHandTilesEl = document.getElementById("corr-handTiles");
const corrDrawTileEl = document.getElementById("corr-drawTile");
const corrChoicesEl = document.getElementById("corr-choices");
const corrAnswerEl = document.getElementById("corr-answer");
const corrAnswerLineEl = document.getElementById("corr-answer-line");
const corrSolutionTextEl = document.getElementById("corr-solution-text");
const corrQuestionImageEl = document.getElementById("corr-question-image");
const corrValidationEl = document.getElementById("corr-validation");
const corrApplyEl = document.getElementById("corr-apply");
const corrClearQEl = document.getElementById("corr-clear-q");
const corrCopyPatchEl = document.getElementById("corr-copy-patch");

document.getElementById("reset-attempt").addEventListener("click", resetAttempt);
document.getElementById("save-note").addEventListener("click", saveNote);
questionSelectEl.addEventListener("change", onQuestionChange);
if (btnPrevEl) btnPrevEl.addEventListener("click", goPrevQuestion);
if (btnNextEl) btnNextEl.addEventListener("click", goNextQuestion);
if (btnPrevBottomEl) btnPrevBottomEl.addEventListener("click", goPrevQuestion);
if (btnNextBottomEl) btnNextBottomEl.addEventListener("click", goNextQuestion);
if (practiceModeEl) practiceModeEl.addEventListener("change", onPracticeModeChange);
if (btnReshuffleEl) btnReshuffleEl.addEventListener("click", onReshuffleQuestions);

if (corrApplyEl) corrApplyEl.addEventListener("click", applyCorrectionFromForm);
if (corrClearQEl) corrClearQEl.addEventListener("click", clearCurrentQuestionOverride);
if (corrCopyPatchEl) corrCopyPatchEl.addEventListener("click", copyCurrentQuestionPatch);

if (questionSectionEl) {
  questionSectionEl.addEventListener("click", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const toggle = target.closest ? target.closest("[data-study-flag-toggle]") : null;
    if (toggle) {
      toggleStudyFlagForCurrentQuestion();
      e.preventDefault();
    }
  });
}

init().catch((err) => {
  if (questionDetailEl) questionDetailEl.innerHTML = `<p class="bad">題庫載入失敗：${String(err)}</p>`;
  if (questionFlagsCompactEl) questionFlagsCompactEl.innerHTML = "";
});

async function init() {
  rawQuestionsBank = JSON.parse(JSON.stringify(await loadQuestions()));
  rebuildQuestionsFromRaw();
  if (QUESTIONS.length === 0) {
    throw new Error("questions.json 內沒有題目");
  }

  const urlParams = new URLSearchParams(location.search);
  const startId = urlParams.get("q");
  const mode = normalizePracticeMode(urlParams.get("mode"));
  if (practiceModeEl) practiceModeEl.value = mode;
  currentQuestionId = startId && QUESTIONS.some((x) => x.id === startId) ? startId : QUESTIONS[0].id;

  if (navHomeEl) {
    const p = new URLSearchParams(location.search);
    const bankOnly = new URLSearchParams();
    const bankVal = p.get("bank");
    if (bankVal) bankOnly.set("bank", bankVal);
    const qs = bankOnly.toString();
    navHomeEl.href = qs ? `./index.html?${qs}` : "./index.html";
  }

  questionSelectEl.innerHTML = QUESTIONS.map((q) => `<option value="${q.id}">${q.title}</option>`).join("");
  questionSelectEl.value = currentQuestionId;
  state.attempts = state.attempts || {};
  state.notes = state.notes || {};
  renderQuestionMeta();
  renderActionArea();
  renderStats();
  renderPracticeModeSummary();
  noteInputEl.value = state.notes[currentQuestionId] || "";
  populateCorrectionForm();
  setStorageOriginHint();
  updatePrevNextButtons();
  syncUrlQuestionParam();
}

function setStorageOriginHint() {
  if (!storageOriginHintEl) return;
  const origin = typeof location !== "undefined" ? location.origin : "";
  storageOriginHintEl.innerHTML = `作答與筆記存在本機 <strong>localStorage</strong>，且<strong>綁定目前網址</strong>（<code>${origin}</code>）。請長期固定<strong>同一主機名與埠</strong>開本頁——例如 <code>http://127.0.0.1:8765</code> 與 <code>http://localhost:8765</code> 會當成<strong>兩個網站</strong>，紀錄不會互通。另：無痕視窗關閉後可能清空、亦勿依賴 <code>file://</code> 開檔。`;
}

function normalizeState(parsed) {
  const s = parsed && typeof parsed === "object" ? parsed : {};
  return {
    attempts: s.attempts && typeof s.attempts === "object" ? s.attempts : {},
    notes: s.notes && typeof s.notes === "object" ? s.notes : {},
    studyFlags: s.studyFlags && typeof s.studyFlags === "object" ? s.studyFlags : {},
    overrides: s.overrides && typeof s.overrides === "object" ? s.overrides : {},
  };
}

function applyBankPatches(questions, bankFile, overridesRoot) {
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

function rebuildQuestionsFromRaw() {
  const base = JSON.parse(JSON.stringify(rawQuestionsBank));
  const allQuestions = normalizeQuestions(
    applyBankPatches(normalizeQuestions(base), currentQuestionBankFile, state.overrides)
  );
  QUESTIONS = applyPracticeModeFilter(allQuestions, normalizePracticeMode(new URLSearchParams(location.search).get("mode")));
  if (QUESTIONS.length === 0) QUESTIONS = allQuestions;

  /** 確保打牌題正解在可出牌集合內（避免覆寫失誤）；僅對 type tile 生效 */
  QUESTIONS.forEach((q, i) => {
    if (q.type !== "tile" || !q.handTiles?.length || !q.answer) return;
    const pool = [...q.handTiles];
    if (q.drawTile) pool.push(q.drawTile);
    if (!pool.includes(q.answer)) {
      console.warn("[mahjong poc] Question", q.id, "answer not in clickable pool after overrides:", q.answer, pool);
    }
  });
}

function normalizePracticeMode(raw) {
  if (raw === "daily10" || raw === "wrongRandom") return raw;
  return "all";
}

function daySeed() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return Number(`${d.getFullYear()}${m}${day}`);
}

function seededShuffle(arr, seed) {
  const out = [...arr];
  let s = (seed >>> 0) || 1;
  const rnd = () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function applyPracticeModeFilter(allQuestions, mode) {
  if (mode === "daily10") {
    return seededShuffle(allQuestions, daySeed()).slice(0, 10);
  }
  if (mode === "wrongRandom") {
    const wrongOnly = allQuestions.filter((q) => (state.attempts[q.id] || []).some((a) => !a.isCorrect));
    return seededShuffle(wrongOnly, Date.now());
  }
  return allQuestions;
}

function renderPracticeModeSummary() {
  if (!modeSummaryEl) return;
  const mode = normalizePracticeMode(new URLSearchParams(location.search).get("mode"));
  if (mode === "daily10") {
    modeSummaryEl.textContent = `今日題單：${QUESTIONS.length} 題（每日固定）`;
    return;
  }
  if (mode === "wrongRandom") {
    modeSummaryEl.textContent = `錯題題單：${QUESTIONS.length} 題`;
    return;
  }
  modeSummaryEl.textContent = `全部題目：${QUESTIONS.length} 題`;
}

function attemptSummaryForQuestion(questionId) {
  const attempts = [...(state.attempts[questionId] || [])];
  attempts.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  const everCorrect = attempts.some((a) => a.isCorrect);
  let lastWrongISO = null;
  let lastCorrectISO = null;
  for (let i = attempts.length - 1; i >= 0; i -= 1) {
    const a = attempts[i];
    if (!a.isCorrect && lastWrongISO == null) lastWrongISO = a.timestamp;
    if (a.isCorrect && lastCorrectISO == null) lastCorrectISO = a.timestamp;
  }
  return {
    everCorrect,
    lastWrongISO,
    lastCorrectISO,
    attemptCount: attempts.length,
  };
}

function formatLocalDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function toggleStudyFlagForCurrentQuestion() {
  state.studyFlags = state.studyFlags || {};
  if (state.studyFlags[currentQuestionId]) delete state.studyFlags[currentQuestionId];
  else state.studyFlags[currentQuestionId] = true;
  saveState();
  renderQuestionMeta();
}

function parseCommaTileList(text) {
  return String(text || "")
    .split(/[,，\s\r\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function showCorrValidation(message) {
  if (!corrValidationEl) return;
  if (!message) {
    corrValidationEl.textContent = "";
    corrValidationEl.classList.add("hidden");
    return;
  }
  corrValidationEl.textContent = message;
  corrValidationEl.classList.remove("hidden");
}

function populateCorrectionForm() {
  const q = getCurrentQuestion();
  if (!q || !corrAnswerEl) return;
  showCorrValidation("");
  if (tileCorrectionFieldsEl && choiceCorrectionFieldsEl) {
    if (q.type === "tile") {
      tileCorrectionFieldsEl.classList.remove("hidden");
      choiceCorrectionFieldsEl.classList.add("hidden");
    } else {
      tileCorrectionFieldsEl.classList.add("hidden");
      choiceCorrectionFieldsEl.classList.remove("hidden");
    }
  }
  if (corrHandTilesEl) corrHandTilesEl.value = (q.handTiles || []).join(", ");
  if (corrDrawTileEl) corrDrawTileEl.value = q.drawTile ? String(q.drawTile) : "";
  if (corrChoicesEl) corrChoicesEl.value = (q.choices || []).join("\n");
  if (corrAnswerEl) corrAnswerEl.value = q.answer || "";
  if (corrAnswerLineEl) corrAnswerLineEl.value = q.answerLine || "";
  if (corrSolutionTextEl) corrSolutionTextEl.value = q.solutionText || "";
  if (corrQuestionImageEl) corrQuestionImageEl.value = q.questionImage ?? "";
}

function validateAndBuildPatch(question) {
  /** @type {Record<string, any>} */
  const patch = {};
  const ans = corrAnswerEl ? corrAnswerEl.value.trim() : "";
  if (!ans) return { error: "請填寫正解 answer。", patch: null };

  if (question.type === "tile") {
    const handTiles = parseCommaTileList(corrHandTilesEl ? corrHandTilesEl.value : "");
    const draw = corrDrawTileEl ? corrDrawTileEl.value.trim() : "";
    if (handTiles.length !== 13) {
      return { error: `手牌需剛好 13 張（目前 ${handTiles.length}）；請對齊截圖順序。`, patch: null };
    }
    patch.handTiles = handTiles;
    patch.drawTile = draw ? draw : null;

    const pool = [...handTiles];
    if (draw) pool.push(draw);
    if (!pool.includes(ans)) {
      return { error: `正解「${ans}」不在「13 張＋摸牌」出牌集合：${pool.join("、") || "（空）"}`, patch: null };
    }
    patch.type = "tile";
  } else {
    const lines = corrChoicesEl
      ? corrChoicesEl.value
          .split(/\r?\n/)
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
    if (!lines.length) return { error: "選項題請至少輸入一行選項文字。", patch: null };
    if (!lines.includes(ans)) return { error: `正解必須是其中一項選項文字（目前未出現在列表）。`, patch: null };
    patch.choices = lines;
    patch.type = "choice";
  }

  patch.answer = ans;
  const al = corrAnswerLineEl ? corrAnswerLineEl.value.trim() : "";
  const st = corrSolutionTextEl ? corrSolutionTextEl.value.trim() : "";
  const qi = corrQuestionImageEl ? corrQuestionImageEl.value.trim() : "";
  if (al) patch.answerLine = al;
  if (st) patch.solutionText = st;
  if (qi) patch.questionImage = qi;
  else if (corrQuestionImageEl && corrQuestionImageEl.value === "") patch.questionImage = null;

  return { error: null, patch };
}

function applyCorrectionFromForm() {
  const baseQ = QUESTIONS.find((x) => x.id === currentQuestionId);
  if (!baseQ) return;
  showCorrValidation("");
  const { error, patch } = validateAndBuildPatch(baseQ);
  if (error || !patch) {
    showCorrValidation(error || "無法套用。");
    return;
  }

  state.overrides = state.overrides || {};
  state.overrides[currentQuestionBankFile] = state.overrides[currentQuestionBankFile] || {};
  state.overrides[currentQuestionBankFile][currentQuestionId] = {
    ...state.overrides[currentQuestionBankFile][currentQuestionId],
    ...patch,
  };
  saveState();
  rebuildQuestionsFromRaw();
  rebuildQuestionSelectOptions();
  questionSelectEl.value = currentQuestionId;
  renderQuestionMeta();
  renderActionArea();
  populateCorrectionForm();
  renderStats();
  alert("已儲存本題覆寫（本機 localStorage），之後載入皆以覆寫後資料為準。");
}

function clearCurrentQuestionOverride() {
  state.overrides = state.overrides || {};
  const m = state.overrides[currentQuestionBankFile];
  if (m && m[currentQuestionId]) {
    delete m[currentQuestionId];
    if (!Object.keys(m).length) delete state.overrides[currentQuestionBankFile];
  }
  saveState();
  rebuildQuestionsFromRaw();
  rebuildQuestionSelectOptions();
  questionSelectEl.value = currentQuestionId;
  renderQuestionMeta();
  renderActionArea();
  populateCorrectionForm();
  renderStats();
}

function rebuildQuestionSelectOptions() {
  const cur = currentQuestionId;
  questionSelectEl.innerHTML = QUESTIONS.map((q) => `<option value="${q.id}">${q.title}</option>`).join("");
  if (QUESTIONS.some((x) => x.id === cur)) questionSelectEl.value = cur;
}

function copyCurrentQuestionPatch() {
  const q = getCurrentQuestion();
  if (!q) return;
  state.overrides = state.overrides || {};
  let patch = state.overrides[currentQuestionBankFile]?.[currentQuestionId];
  if (!patch) {
    const v = validateAndBuildPatch(q);
    if (v.error || !v.patch) {
      showCorrValidation(v.error || "請先確認表單內容可通過檢核。");
      return;
    }
    patch = v.patch;
  }
  const text = JSON.stringify({ bank: currentQuestionBankFile, questionId: currentQuestionId, patch }, null, 2);
  void navigator.clipboard.writeText(text).then(
    () => alert("已複製本題 patch（含 bank／questionId）到剪貼簿。"),
    () => {
      alert("無法使用剪貼簿 API，請手動複製：\n" + text);
    }
  );
}

function normalizeQuestions(questions) {
  const choiceDefaults = {
    q5: { prompt: "有4枚中呢，可以暗槓哦", choices: ["槓", "不槓（改打7m）"] },
    q6: { prompt: "還是東1局 第8巡 東家 dora還是9p跟南", choices: ["打7m立直", "默聽"] },
  };
  const expandCompoundTileChoice = (text) => {
    const s = String(text || "").trim();

    // e.g. 89m / 12p / 345s -> 8m,9m / 1p,2p / 3s,4s,5s
    const compact = s.match(/^([0-9]{2,})([mpsz])$/i);
    if (compact) {
      return compact[1].split("").map((n) => `${n}${compact[2].toLowerCase()}`);
    }

    // e.g. 1p/2p, 1p 或 2p, 1p、2p
    const tokenMatches = [...s.matchAll(/([1-9][mpsz]|[東南西北白發中])/giu)].map((m) => m[1]);
    const cleanedTokens = [...new Set(tokenMatches.map((x) => String(x).toLowerCase()))];
    const reduced = s.replace(/([1-9][mpsz]|[東南西北白發中])/giu, "").replace(/[\/,，、\s或或者與和]/gu, "");
    if (cleanedTokens.length >= 2 && reduced.length === 0) {
      return cleanedTokens;
    }

    return null;
  };
  const cleanChoiceLabel = (s) => {
    const t = String(s || "").trim().replace(/\s+/g, " ");
    const m = t.match(/^([1-9][mps]|[東南西北白發中])\s*\d+\s*向[听聽]$/u);
    return m ? m[1] : t;
  };
  const dedupe = (arr) => {
    const out = [];
    const seen = new Set();
    (arr || []).forEach((x) => {
      const key = String(x);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(key);
    });
    return out;
  };
  return questions.map((q) => {
    let next = { ...q };
    if (next.type === "choice") {
      const d = choiceDefaults[next.id];
      if (d) {
        next = {
          ...next,
          prompt: next.prompt || d.prompt,
          choices: next.choices && next.choices.length ? next.choices : [...d.choices],
        };
      }
      const expandedChoices = [];
      (next.choices || []).map(cleanChoiceLabel).forEach((label) => {
        const split = expandCompoundTileChoice(label);
        if (split && split.length > 1) expandedChoices.push(...split);
        else expandedChoices.push(label);
      });
      const cleanedChoices = dedupe(expandedChoices);
      next.choices = cleanedChoices;
      next.answer = cleanChoiceLabel(next.answer || "");
      const isNakiDecision = /[吃碰槓杠]/u.test(next.answer || "");
      if (isNakiDecision && cleanedChoices.length >= 2) {
        const tileOnly = cleanedChoices.filter((c) => /^[1-9][mpsz]$/i.test(c) || /^[東南西北白發中]$/u.test(c));
        if (tileOnly.length > 0) {
          next.choices = [next.answer, "不鳴（不吃／不碰）"];
        }
      }
    }
    return next;
  });
}

function acceptedAnswersForQuestion(question) {
  const out = new Set();
  const base = String(question?.answer || "").trim();
  if (!base) return out;
  out.add(base);
  out.add(base.toLowerCase());

  const compact = base.match(/^([0-9]{2,})([mpsz])$/i);
  if (compact) {
    compact[1].split("").forEach((n) => out.add(`${n}${compact[2].toLowerCase()}`));
  }

  const tiles = [...base.matchAll(/([1-9][mpsz]|[東南西北白發中])/giu)].map((m) => String(m[1]).toLowerCase());
  const reduced = base.replace(/([1-9][mpsz]|[東南西北白發中])/giu, "").replace(/[\/,，、\s或或者與和]/gu, "");
  if (tiles.length >= 2 && reduced.length === 0) {
    tiles.forEach((t) => out.add(t));
  }

  return out;
}

function renderQuestionDiagram() {
  const question = getCurrentQuestion();
  if (!diagramWrapEl || !question) return;
  diagramWrapEl.innerHTML = "";
  const showDiag = Boolean(question.questionImage);

  if (!showDiag) {
    diagramWrapEl.classList.remove("hidden");
    diagramWrapEl.innerHTML = `
      <div class="diagram-placeholder">
        <p class="hint"><strong>${question.title}</strong> 沒有題目附圖（<code>questionImage</code> 為空）。請看<strong>緊接在下面的題幹與局況</strong>，再用下方出牌區作答。</p>
      </div>
    `;
    return;
  }
  diagramWrapEl.classList.remove("hidden");
  const belowTiles =
    question.type === "tile" && question.handTiles && question.handTiles.length > 0
      ? "（與上方可點手牌一致；紅寶牌以一般數字牌顯示）"
      : "";
  diagramWrapEl.innerHTML = `
    <p class="hint">參考題圖 ${belowTiles}</p>
    <img class="diagram-img" src="${question.questionImage}" alt="題目附圖" loading="lazy" />
  `;
}

function renderQuestionMeta() {
  const question = getCurrentQuestion();
  if (!question) return;
  const metaChunks = [];
  if (question.context?.round) metaChunks.push(`局況：${question.context.round}`);
  if (question.context?.turn) metaChunks.push(`巡目：${question.context.turn}`);
  if (question.context?.seatWind) metaChunks.push(`自風：${question.context.seatWind}`);
  if (question.context?.dora) metaChunks.push(`Dora：${question.context.dora}`);
  const references = (question.references || [])
    .map((item) => `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.label}</a>`)
    .join("｜");

  const h = attemptSummaryForQuestion(question.id);
  const flagged = Boolean(state.studyFlags?.[question.id]);
  const hasOverride = Boolean(state.overrides?.[currentQuestionBankFile]?.[question.id]);

  let historyOneLine = "尚無答題紀錄";
  if (h.attemptCount > 0) {
    const ok = h.everCorrect ? "曾答對" : "尚未答對過";
    historyOneLine = `${ok}｜上次答錯：${formatLocalDateTime(h.lastWrongISO)}｜上次答對：${formatLocalDateTime(h.lastCorrectISO)}`;
  }

  if (questionFlagsCompactEl) {
    questionFlagsCompactEl.innerHTML = `
      <div class="flags-compact-inner">
        <span class="flags-compact-history ${h.attemptCount > 0 && !h.everCorrect ? "warn-line" : ""}">${historyOneLine}</span>
        ${hasOverride ? `<span class="flags-override-chip" title="此題有本機覆寫；還原請至下方回報區「清除本題覆寫」">覆寫</span>` : ""}
        ${flagged ? `<span class="small-star" title="已標記複習">★</span>` : ""}
        <button type="button" class="study-flag-btn study-flag-compact ${flagged ? "study-flag-on" : ""}" data-study-flag-toggle>
          ${flagged ? "已複習標記" : "複習標記"}
        </button>
      </div>
    `;
  }

  if (questionDetailEl) {
    questionDetailEl.innerHTML = `
      <p class="hint bank-hint">題庫檔：<code>data/${currentQuestionBankFile}</code></p>
      <p class="question-detail-title"><strong>${question.title}</strong></p>
      ${question.prompt ? `<p>${question.prompt}</p>` : ""}
      ${metaChunks.length > 0 ? `<p>${metaChunks.join("｜")}</p>` : ""}
      <p>難度：${question.difficulty}｜標籤：${question.tags.join("、")}</p>
      <p>參考：${references}</p>
    `;
  }
}

function renderActionArea() {
  const question = getCurrentQuestion();
  if (!question) return;
  clearInlineOutcomeLabels();
  renderQuestionDiagram();

  handTilesEl.innerHTML = "";
  choiceActionsEl.innerHTML = "";

  if (question.type === "tile") {
    actionTitleEl.textContent = "手牌";
    handTilesEl.classList.remove("hidden");
    choiceActionsEl.classList.add("hidden");
    if (question.handTiles.length === 0) {
      handTilesEl.innerHTML = `<p class="hint">此題尚無題庫內建的 13+1 網頁出牌；請看上方題圖或自行補 <code>handTiles</code>／<code>questionImage</code>（見 README）。</p>`;
      return;
    }

    let interactionIndex = 0;
    question.handTiles.forEach((tile) => {
      handTilesEl.appendChild(createWrappedTileButton(tile, interactionIndex));
      interactionIndex += 1;
    });
    if (question.drawTile) {
      const separator = document.createElement("div");
      separator.className = "draw-separator";
      handTilesEl.appendChild(separator);
      handTilesEl.appendChild(createWrappedTileButton(question.drawTile, interactionIndex));
    }
    return;
  }

  actionTitleEl.textContent = "選項";
  handTilesEl.classList.add("hidden");
  choiceActionsEl.classList.remove("hidden");
  if (!question.choices || question.choices.length === 0) {
    choiceActionsEl.innerHTML =
      `<p class="bad">題庫缺少選項 choices；請確認使用 data/questions.json 或更新抽取腳本。</p>`;
    return;
  }
  question.choices.forEach((choice, i) => {
    choiceActionsEl.appendChild(createWrappedChoiceButton(choice, i));
  });
}

function clearInlineOutcomeLabels() {
  document.querySelectorAll(".inline-outcome").forEach((el) => {
    el.textContent = "";
    el.classList.remove("ok", "bad");
  });
}

function createWrappedTileButton(tile, interactionIndex) {
  const wrap = document.createElement("div");
  wrap.className = "choice-with-feedback";
  const btn = document.createElement("button");
  btn.className = "tile-btn";
  btn.innerHTML = renderTileFace(tile);
  btn.setAttribute("aria-label", `打出 ${tile}`);
  btn.title = `打出 ${tile}`;
  btn.addEventListener("click", () => submitAnswer(tile, { interactionIndex }));
  const out = document.createElement("div");
  out.className = "inline-outcome";
  out.setAttribute("data-interaction-slot", String(interactionIndex));
  wrap.appendChild(btn);
  wrap.appendChild(out);
  return wrap;
}

function createWrappedChoiceButton(choiceText, interactionIndex) {
  const wrap = document.createElement("div");
  wrap.className = "choice-with-feedback choice-row";
  const btn = document.createElement("button");
  btn.className = "choice-btn";
  btn.innerHTML = renderChoiceLabel(choiceText);
  btn.addEventListener("click", () => submitAnswer(choiceText, { interactionIndex }));
  const out = document.createElement("div");
  out.className = "inline-outcome";
  out.setAttribute("data-interaction-slot", String(interactionIndex));
  wrap.appendChild(btn);
  wrap.appendChild(out);
  return wrap;
}

function renderChoiceLabel(text) {
  const s = escapeHtmlForChoice(String(text || ""));
  // Wrap Mahjong Unicode tiles so mobile can control glyph size.
  return s.replace(/([\uD83C][\uDC00-\uDC2F])/g, '<span class="choice-tile-inline">$1</span>');
}

function escapeHtmlForChoice(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTileFace(tileCode) {
  const unicodeTile = tileCodeToUnicode(tileCode);
  if (unicodeTile) {
    return `<span class="tile-unicode">${unicodeTile}</span><span class="tile-code">${tileCode}</span>`;
  }
  return `<span class="tile-unicode">?</span><span class="tile-code">${tileCode}</span>`;
}

function tileCodeToUnicode(tileCode) {
  const honors = {
    東: "🀀",
    南: "🀁",
    西: "🀂",
    北: "🀃",
    白: "🀆",
    發: "🀅",
    中: "🀄",
  };
  if (honors[tileCode]) return honors[tileCode];

  if (tileCode.length !== 2) return "";
  const num = Number(tileCode[0]);
  const suit = tileCode[1];
  if (!Number.isInteger(num) || num < 1 || num > 9) return "";

  if (suit === "m") return String.fromCodePoint(0x1f007 + (num - 1));
  if (suit === "s") return String.fromCodePoint(0x1f010 + (num - 1));
  if (suit === "p") return String.fromCodePoint(0x1f019 + (num - 1));
  if (suit === "z") return String.fromCodePoint(0x1f000 + (num - 1));
  return "";
}

function submitAnswer(chosen, meta = {}) {
  const question = getCurrentQuestion();
  if (!question) return;
  const acceptedAnswers = acceptedAnswersForQuestion(question);
  const chosenKey = String(chosen || "").trim().toLowerCase();
  const isCorrect = acceptedAnswers.size ? acceptedAnswers.has(chosenKey) || acceptedAnswers.has(String(chosen || "").trim()) : chosen === question.answer;
  const attempts = state.attempts[question.id] || [];

  attempts.push({
    chosen,
    isCorrect,
    timestamp: new Date().toISOString(),
  });
  state.attempts[question.id] = attempts;
  saveState();

  clearInlineOutcomeLabels();
  const root = question.type === "tile" ? handTilesEl : choiceActionsEl;
  const slot =
    meta && Number.isInteger(meta.interactionIndex)
      ? root.querySelector(`[data-interaction-slot="${meta.interactionIndex}"]`)
      : null;
  if (slot) {
    slot.classList.add(isCorrect ? "ok" : "bad");
    slot.textContent = isCorrect
      ? "答對"
      : `答錯（書中：${question.answer}）`;
  }

  resultSectionEl.classList.remove("hidden");
  resultSummaryEl.className = isCorrect ? "ok" : "bad";
  resultSummaryEl.textContent = isCorrect
    ? `你選擇 ${chosen}，答對。`
    : `你選擇 ${chosen}，答錯。`;
  answerLineEl.textContent = question.answerLine;
  solutionTextEl.textContent = question.solutionText;

  renderStats();
  renderQuestionMeta();
  updatePrevNextButtons();
}

function resetAttempt() {
  clearInlineOutcomeLabels();
  resultSectionEl.classList.add("hidden");
  resultSummaryEl.textContent = "";
  answerLineEl.textContent = "";
  solutionTextEl.textContent = "";
}

function saveNote() {
  state.notes[currentQuestionId] = noteInputEl.value.trim();
  saveState();
  alert("筆記已儲存（本機 localStorage）。");
}

function renderStats() {
  const question = getCurrentQuestion();
  if (!question) return;
  const currentAttempts = state.attempts[question.id] || [];
  const total = currentAttempts.length;
  const correct = currentAttempts.filter((a) => a.isCorrect).length;
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);

  const allAttempts = Object.values(state.attempts).flat();
  const allTotal = allAttempts.length;
  const allCorrect = allAttempts.filter((a) => a.isCorrect).length;
  const allAccuracy = allTotal === 0 ? 0 : Math.round((allCorrect / allTotal) * 100);
  const wrongCountByTag = {};
  QUESTIONS.forEach((q) => {
    const wrong = (state.attempts[q.id] || []).filter((a) => !a.isCorrect).length;
    q.tags.forEach((tag) => {
      wrongCountByTag[tag] = (wrongCountByTag[tag] || 0) + wrong;
    });
  });
  const weakTopics = Object.entries(wrongCountByTag)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag, count]) => `${tag}：${count}`)
    .join("｜");

  statsListEl.innerHTML = `
    <li>全題總作答次數：${allTotal}</li>
    <li>全題正確率：${allAccuracy}%</li>
    <li>總作答次數：${total}</li>
    <li>正確率：${accuracy}%</li>
    <li>本題錯誤次數：${total - correct}</li>
    <li>主題弱點追蹤：${weakTopics || "尚無資料"}</li>
  `;
}

function onQuestionChange(event) {
  currentQuestionId = event.target.value;
  resetAttempt();
  renderQuestionMeta();
  renderActionArea();
  renderStats();
  noteInputEl.value = state.notes[currentQuestionId] || "";
  populateCorrectionForm();
  updatePrevNextButtons();
  syncUrlQuestionParam();
}

function currentQuestionIndex() {
  return QUESTIONS.findIndex((q) => q.id === currentQuestionId);
}

function goPrevQuestion() {
  const i = currentQuestionIndex();
  if (i <= 0) return;
  selectQuestionById(QUESTIONS[i - 1].id);
}

function goNextQuestion() {
  const i = currentQuestionIndex();
  if (i < 0 || i >= QUESTIONS.length - 1) return;
  selectQuestionById(QUESTIONS[i + 1].id);
}

function selectQuestionById(id) {
  currentQuestionId = id;
  questionSelectEl.value = id;
  resetAttempt();
  renderQuestionMeta();
  renderActionArea();
  renderStats();
  noteInputEl.value = state.notes[currentQuestionId] || "";
  populateCorrectionForm();
  updatePrevNextButtons();
  syncUrlQuestionParam();
}

function onPracticeModeChange() {
  const mode = practiceModeEl ? normalizePracticeMode(practiceModeEl.value) : "all";
  const url = new URL(window.location.href);
  if (mode === "all") url.searchParams.delete("mode");
  else url.searchParams.set("mode", mode);
  url.searchParams.delete("q");
  window.history.replaceState({}, "", url.toString());
  rebuildQuestionsFromRaw();
  rebuildQuestionSelectOptions();
  currentQuestionId = QUESTIONS[0]?.id || currentQuestionId;
  if (questionSelectEl && currentQuestionId) questionSelectEl.value = currentQuestionId;
  resetAttempt();
  renderQuestionMeta();
  renderActionArea();
  renderStats();
  renderPracticeModeSummary();
  noteInputEl.value = state.notes[currentQuestionId] || "";
  populateCorrectionForm();
  updatePrevNextButtons();
  syncUrlQuestionParam();
}

function onReshuffleQuestions() {
  const mode = normalizePracticeMode(new URLSearchParams(location.search).get("mode"));
  if (mode === "all") return;
  rebuildQuestionsFromRaw();
  rebuildQuestionSelectOptions();
  currentQuestionId = QUESTIONS[0]?.id || currentQuestionId;
  if (questionSelectEl && currentQuestionId) questionSelectEl.value = currentQuestionId;
  resetAttempt();
  renderQuestionMeta();
  renderActionArea();
  renderStats();
  renderPracticeModeSummary();
  noteInputEl.value = state.notes[currentQuestionId] || "";
  populateCorrectionForm();
  updatePrevNextButtons();
  syncUrlQuestionParam();
}

function updatePrevNextButtons() {
  const i = currentQuestionIndex();
  const atStart = i <= 0;
  const atEnd = i < 0 || i >= QUESTIONS.length - 1;
  if (btnPrevEl) btnPrevEl.disabled = atStart;
  if (btnNextEl) btnNextEl.disabled = atEnd;
  if (btnPrevBottomEl) btnPrevBottomEl.disabled = atStart;
  if (btnNextBottomEl) btnNextBottomEl.disabled = atEnd;
}

function syncUrlQuestionParam() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("q", currentQuestionId);
    const mode = practiceModeEl ? normalizePracticeMode(practiceModeEl.value) : "all";
    if (mode === "all") url.searchParams.delete("mode");
    else url.searchParams.set("mode", mode);
    window.history.replaceState({}, "", url.toString());
  } catch {
    /* ignore file:// etc */
  }
}

function getCurrentQuestion() {
  return QUESTIONS.find((q) => q.id === currentQuestionId);
}

const QUESTION_BANK_FILES = ["questions.json", "questions.generated.json"];

function resolveQuestionBankFile() {
  const name = new URLSearchParams(location.search).get("bank");
  if (name && QUESTION_BANK_FILES.includes(name)) {
    return name;
  }
  return "questions.json";
}

async function loadQuestions() {
  const file = resolveQuestionBankFile();
  currentQuestionBankFile = file;
  const url = `./data/${file}`;

  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    throw new Error(
      '目前用「本機檔案 file://」開頁，`fetch()` 會被瀏覽器擋下。請在 PowerShell：`cd "...\\mahjong-tile-efficiency-poc"` 後執行 `python -m http.server 8765`，再開 `http://127.0.0.1:8765/play.html`（網址必須是 http，不是開磁碟檔案）。'
    );
  }

  let response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    throw new Error(
      `無法連線載入題庫（${url}）。常見原因：未啟動本機 server、或網頁伺服器的工作目錄不是 mahjong-tile-efficiency-poc（會 404）。詳情：${msg}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `${url} 回傳 HTTP ${response.status}。請確認 server 的根目錄是資料夾 mahjong-tile-efficiency-poc（裡面要有 data\\${file}），例如先在該資料夾執行：python -m http.server 8765`
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`${url} 不是合法 JSON（可能抓錯檔或被 CDN 換成錯頁）。`);
  }

  return data.questions || [];
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return normalizeState(null);
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return normalizeState(null);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
}
