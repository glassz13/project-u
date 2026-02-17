// script.js (fully fixed)
// Overwrite your existing file with this version.

// -------------------- Config (same as Python) --------------------
const FILES = {
  stage1: "data/stage1.json",
  stage2: "data/stage2.json",
  stage3: "data/stage3.json",
  csat: "data/csat.json",
  rapidfire: "data/rapidfire.json",
};

const STAGE_CONFIG = {
  1: { total: 10, stage_count: 8, csat_count: 2, csat_level: "medium" },
  2: { total: 15, stage_count: 11, csat_count: 4, csat_level: "hard" },
  3: { total: 20, stage_count: 14, csat_count: 6, csat_level: "super_hard" },
};

const RAPID_FIRE_COUNT = 10;
const RAPID_FIRE_PASS = 6;

const START_LIVES = 5;
const START_RANK = 1000000; // 10_00_000
const GAME_OVER_MSG = {
  1: "Game Over! Congratulations! You are promoted to Chaprasi! 😂",
  2: "Game Over! Hehehehehe 😜",
  3: "Nice try, Diddy! You can be an officer! Keep it up! 👮‍♂️",
};
const VICTORY_MSG = "It is a pleasure to meet you, DM Sir! 🌟👏";

// -------------------- State --------------------
let stage1_qs = [], stage2_qs = [], stage3_qs = [], csat_all = [], rapid_qs = [];

let lives = START_LIVES;
let rank = START_RANK;
let streak = 0;
let milestones = 0;

let currentStageNum = 1;
let currentStageQs = []; // shuffled questions for current stage
let currentQIndex = 0;

let isRapidFireActive = false;
let rapidState = null; // object to hold rapid-fire state when active

// DOM refs
const el = {
  lives: () => document.getElementById("lives"),
  rank: () => document.getElementById("rank"),
  streak: () => document.getElementById("streak"),
  stage: () => document.getElementById("stage"),
  stageLevel: () => document.getElementById("stage-level"),
  question: () => document.getElementById("question"),
  answer: () => document.getElementById("answer"),
  submitBtn: () => document.getElementById("submitBtn"),
  message: () => document.getElementById("message"),
  statsContainer: () => document.querySelector(".stats"),
};

// Create a tiny message element under stats for small updates (streak +1 etc.)
let tinyMsgEl = null;
function ensureTinyMsg() {
  if (!tinyMsgEl) {
    tinyMsgEl = document.createElement("div");
    tinyMsgEl.style.marginTop = "8px";
    tinyMsgEl.style.color = "#cdd3d8";
    tinyMsgEl.style.fontSize = "0.95rem";
    const stats = el.statsContainer();
    if (stats) stats.parentNode.insertBefore(tinyMsgEl, stats.nextSibling);
    else document.body.appendChild(tinyMsgEl);
  }
  return tinyMsgEl;
}
function showTinyMessage(text, ms = 2200) {
  const t = ensureTinyMsg();
  t.textContent = text;
  t.style.opacity = "1";
  setTimeout(() => {
    t.style.transition = "opacity 300ms";
    t.style.opacity = "0";
    setTimeout(() => (t.textContent = ""), 350);
  }, ms);
}

// -------------------- Utilities --------------------
function normalizeAnswer(s) {
  if (s === undefined || s === null) return "";
  return String(s).trim().replace(/\s+/g, " ").toLowerCase();
}

function numericCompare(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (isNaN(na) || isNaN(nb)) return false;
  return Math.abs(na - nb) < 1e-9;
}

function chooseRandomSample(arr, n) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const out = [];
  if (arr.length >= n) {
    const copy = arr.slice();
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  } else {
    out.push(...arr);
    while (out.length < n) {
      out.push(arr[Math.floor(Math.random() * arr.length)]);
    }
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// -------------------- Load JSON data --------------------
async function loadAllData() {
  try {
    const s1 = await fetch(FILES.stage1).then(r => { if(!r.ok) throw new Error("s1"); return r.json(); });
    const s2 = await fetch(FILES.stage2).then(r => { if(!r.ok) throw new Error("s2"); return r.json(); });
    const s3 = await fetch(FILES.stage3).then(r => { if(!r.ok) throw new Error("s3"); return r.json(); });
    const csat = await fetch(FILES.csat).then(r => { if(!r.ok) throw new Error("csat"); return r.json(); });
    const rapid = await fetch(FILES.rapidfire).then(r => { if(!r.ok) throw new Error("rapid"); return r.json(); });

    stage1_qs = s1 || [];
    stage2_qs = s2 || [];
    stage3_qs = s3 || [];
    csat_all = csat || [];
    rapid_qs = rapid || [];

    console.log(`Loaded counts → stage1:${stage1_qs.length}, stage2:${stage2_qs.length}, stage3:${stage3_qs.length}, csat:${csat_all.length}, rapid:${rapid_qs.length}`);
  } catch (err) {
    alert("Error loading question data. Check console.");
    console.error("loadAllData error:", err);
  }
}

// -------------------- Rank update (now never goes below 1) --------------------
function updateRankByOne(rankValue) {
  let r = Math.floor(rankValue / 5);
  return Math.max(r, 1);
}

// -------------------- UI helpers --------------------
function setStatsUI() {
  if (el.lives()) el.lives().textContent = String(lives);
  if (el.rank()) el.rank().textContent = rank.toLocaleString();
  if (el.streak()) el.streak().textContent = String(streak);
  if (el.stage()) el.stage().textContent = String(currentStageNum);
}

function setStageLevelText(num) {
  const lvl = STAGE_CONFIG[num].csat_level;
  const human = (lvl === "medium") ? "Medium" : (lvl === "hard") ? "Hard" : "Super Hard";
  const elLevel = document.getElementById("stage-level");
  if (elLevel) elLevel.textContent = human;
}

// overlay for game over / victory
function showOverlay(title, text, buttonText = "Restart", onButton = null) {
  const existing = document.getElementById("pu-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "pu-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(8,10,12,0.85)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    color: "#fff",
    padding: "20px",
    boxSizing: "border-box",
  });

  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "#121315",
    padding: "28px",
    borderRadius: "10px",
    maxWidth: "720px",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.6)"
  });

  const t = document.createElement("h2");
  t.textContent = title;
  t.style.margin = "0 0 10px";
  t.style.fontWeight = "600";

  const p = document.createElement("p");
  p.textContent = text;
  p.style.color = "#cfd6da";
  p.style.margin = "8px 0 18px";

  const btn = document.createElement("button");
  btn.textContent = buttonText;
  Object.assign(btn.style, {
    padding: "10px 18px",
    fontSize: "1rem",
    border: "none",
    cursor: "pointer",
    background: "#2f3640",
    color: "#fff",
    borderRadius: "6px"
  });

  btn.onclick = () => {
    overlay.remove();
    if (typeof onButton === "function") onButton();
  };

  card.appendChild(t);
  card.appendChild(p);
  card.appendChild(btn);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// -------------------- Core evaluation --------------------
function checkAnswerCorrect(userInput, correctField) {
  // Skip if correct field is missing or empty
  if (!correctField || correctField === "") {
    console.warn("Question has no correct answer defined");
    return false;
  }

  let alternatives = [];
  if (Array.isArray(correctField)) {
    alternatives = correctField.map(String);
  } else if (typeof correctField === "string") {
    const s = correctField;
    if (s.includes("|")) alternatives = s.split("|").map(x => x.trim());
    else if (s.includes(";")) alternatives = s.split(";").map(x => x.trim());
    else alternatives = [s.trim()];
  } else {
    alternatives = [String(correctField)];
  }

  const userNorm = normalizeAnswer(userInput);

  for (let alt of alternatives) {
    const altNorm = normalizeAnswer(alt);

    if (altNorm === userNorm && altNorm !== "") return true;

    if (!isNaN(Number(altNorm)) && !isNaN(Number(userNorm))) {
      if (numericCompare(altNorm, userNorm)) return true;
    }

    if (altNorm.length <= 3 && /^[a-z0-9]$/.test(altNorm)) {
      if (altNorm === userNorm) return true;
      continue;
    }
  }
  return false;
}

// -------------------- Stage preparation & flow --------------------
function prepareStage(stageNum) {
  const cfg = STAGE_CONFIG[stageNum];
  const stageQuestions = (stageNum === 1 ? stage1_qs : (stageNum === 2 ? stage2_qs : stage3_qs)) || [];
  const csatLevel = cfg.csat_level;

  const csatFiltered = csat_all.filter(q => {
    return String(q.level || "").trim().toLowerCase() === String(csatLevel).trim().toLowerCase();
  });

  const selectedStage = chooseRandomSample(stageQuestions, cfg.stage_count);
  const selectedCsat = chooseRandomSample(csatFiltered, cfg.csat_count);

  const combined = selectedStage.concat(selectedCsat);
  shuffleInPlace(combined);
  return combined;
}

function startStage(stageNum) {
  currentStageNum = stageNum;
  currentStageQs = prepareStage(stageNum);
  currentQIndex = 0;
  setStageLevelText(stageNum);
  const ansEl = document.getElementById("answer");
  if (ansEl) ansEl.value = "";
  setStatsUI();
  showNextQuestion();
}

// show next question or finish stage
function showNextQuestion() {
  if (lives <= 0) return;

  if (currentQIndex >= currentStageQs.length) {
    showTinyMessage(`✅ Stage ${currentStageNum} completed! Remaining lives: ${lives}`);
    // Offer rapid fire only after stages 1 and 2, not after stage 3
    if (currentStageNum < 3) {
      setTimeout(() => { rapidFirePrompt(); }, 400);
    } else {
      // After stage 3 go directly to victory
      setTimeout(() => { proceedAfterRapid(); }, 400);
    }
    return;
  }

  const q = currentStageQs[currentQIndex];
  const qText = q.question || "(no question)";
  document.getElementById("question").textContent = qText;
  const ansEl = document.getElementById("answer");
  if (ansEl) {
    ansEl.value = "";
    ansEl.focus();
  }
  setStatsUI();
  clearMessageArea();
}

// -------------------- Submit / process answer --------------------
function clearMessageArea() {
  const m = el.message();
  if (m) m.innerHTML = "";
}

function submitAnswer() {
  if (isRapidFireActive) {
    handleRapidAnswer();
    return;
  }

  const inputEl = el.answer();
  if (!inputEl) return;
  const user = inputEl.value;
  const q = currentStageQs[currentQIndex];
  if (!q) {
    console.warn("No current question at index", currentQIndex, "stage", currentStageNum);
    return;
  }

  const correctField = q.correct || q.answer || "";
  // Skip if no correct answer defined (treat as wrong but don't penalise?)
  // We'll treat as wrong and still deduct life to avoid infinite loop.
  // But we could also skip the question. For fairness, we'll deduct.
  if (!correctField) {
    console.warn("Question missing correct answer:", q);
  }

  const isCorrect = checkAnswerCorrect(user, correctField);

  if (isCorrect) {
    const m = el.message();
    if (m) m.textContent = "✅ Correct!";
    streak += 1;

    if (streak > 0 && streak % 3 === 0) {
      lives += 1;
      milestones += 1;
      rank = updateRankByOne(rank);
      showTinyMessage(`🔥 Streak ${streak}! +1 life! Rank upgraded to ${rank.toLocaleString()}`);
    } else {
      showTinyMessage(`✅ Correct (Streak ${streak})`);
    }

    currentQIndex += 1;
    setTimeout(() => {
      setStatsUI();
      showNextQuestion();
    }, 350);
  } else {
    const m = el.message();
    if (m) m.textContent = `❌ Wrong. Correct: ${String(correctField)}`;
    lives -= 1;
    streak = 0;
    setStatsUI();

    if (lives <= 0) {
      const msg = GAME_OVER_MSG[currentStageNum] || "Game Over!";
      setTimeout(() => {
        showOverlay("Game Over", msg + `\n\nFinal Rank: ${rank.toLocaleString()}`, "Restart", () => {
          window.location.reload();
        });
      }, 500);
      return;
    }

    currentQIndex += 1;
    setTimeout(() => {
      showNextQuestion();
    }, 450);
  }
}

// -------------------- Rapid Fire (UI below answer area) --------------------
function rapidFirePrompt() {
  const m = el.message();
  if (!m) return;
  m.innerHTML = "";
  const box = document.createElement("div");
  box.style.background = "#101214";
  box.style.border = "1px solid #2a2d30";
  box.style.padding = "12px";
  box.style.display = "inline-block";
  box.style.borderRadius = "8px";
  box.style.textAlign = "left";
  box.style.minWidth = "320px";

  const p = document.createElement("div");
  p.style.color = "#d6dde0";
  p.style.marginBottom = "8px";
  p.textContent = `🔥 RAPID FIRE ROUND — Answer ${RAPID_FIRE_COUNT} quick questions. Get at least ${RAPID_FIRE_PASS} correct to earn +2 lives!`;

  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "8px";
  btnRow.style.marginTop = "8px";

  const yes = document.createElement("button");
  yes.textContent = "Play Rapid Fire";
  yes.onclick = () => {
    m.innerHTML = "";
    startRapidFire();
  };

  const no = document.createElement("button");
  no.textContent = "Skip";
  no.onclick = () => {
    m.innerHTML = "";
    proceedAfterRapid();
  };

  btnRow.appendChild(yes);
  btnRow.appendChild(no);
  box.appendChild(p);
  box.appendChild(btnRow);

  m.appendChild(box);
}

function startRapidFire() {
  isRapidFireActive = true;
  const selected = chooseRandomSample(rapid_qs, Math.min(RAPID_FIRE_COUNT, rapid_qs.length));
  rapidState = {
    questions: selected,
    idx: 0,
    correctCount: 0,
  };
  renderRapidQuestion();
}

function renderRapidQuestion() {
  const m = el.message();
  if (!m || !rapidState) return;
  m.innerHTML = "";
  const qObj = rapidState.questions[rapidState.idx];
  const container = document.createElement("div");
  container.style.background = "#0f1416";
  container.style.border = "1px solid #2a2d30";
  container.style.padding = "12px";
  container.style.borderRadius = "8px";
  container.style.minWidth = "340px";
  container.style.textAlign = "left";

  const title = document.createElement("div");
  title.style.color = "#dbe6ea";
  title.style.fontWeight = "600";
  title.style.marginBottom = "8px";
  title.textContent = `Rapid ${rapidState.idx + 1} of ${rapidState.questions.length}`;

  const qText = document.createElement("div");
  qText.style.color = "#cfd9db";
  qText.style.marginBottom = "8px";
  qText.textContent = qObj.question || "(no question)";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type answer and press Submit";
  input.style.width = "100%";
  input.style.padding = "8px";
  input.style.marginTop = "6px";
  input.style.background = "transparent";
  input.style.border = "1px solid #2b2f33";
  input.style.color = "#fff";

  const submit = document.createElement("button");
  submit.textContent = "Submit";
  submit.style.marginTop = "8px";
  submit.onclick = () => {
    const user = input.value || "";
    handleRapidSingleAnswer(user);
  };

  container.appendChild(title);
  container.appendChild(qText);
  container.appendChild(input);
  container.appendChild(submit);

  m.appendChild(container);
  input.focus();

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit.click();
    }
  });
}

function handleRapidSingleAnswer(user) {
  if (!rapidState) return;
  const qObj = rapidState.questions[rapidState.idx];
  const correctField = qObj.correct || qObj.answer || "";
  const ok = checkAnswerCorrect(user, correctField);
  if (ok) rapidState.correctCount += 1;

  const m = el.message();
  if (m) {
    const fb = document.createElement("div");
    fb.textContent = ok ? "✅ Correct!" : `❌ Wrong. Correct: ${String(correctField)}`;
    fb.style.marginTop = "8px";
    fb.style.color = ok ? "#9fe39f" : "#f39b9b";
    m.appendChild(fb);
  }

  rapidState.idx += 1;
  if (rapidState.idx < rapidState.questions.length) {
    setTimeout(() => renderRapidQuestion(), 450);
  } else {
    setTimeout(() => finishRapidFire(), 500);
  }
}

function handleRapidAnswer() { /* main submit ignored during rapid */ }

function finishRapidFire() {
  isRapidFireActive = false;
  const count = rapidState.correctCount;
  const total = rapidState.questions.length;
  rapidState = null;
  const m = el.message();
  if (m) m.innerHTML = `You got ${count} correct out of ${total}.`;

  if (count >= RAPID_FIRE_PASS) {
    lives += 2;
    showTinyMessage(`🎉 Rapid Fire success! +2 lives. Lives now: ${lives}`);
  } else {
    showTinyMessage("No bonus this time. Better luck next stage!");
  }
  setStatsUI();

  setTimeout(() => {
    clearMessageArea();
    proceedAfterRapid();
  }, 900);
}

function proceedAfterRapid() {
  if (currentStageNum < 3) {
    startStage(currentStageNum + 1);
  } else {
    showOverlay("Victory!", `${VICTORY_MSG}\nFinal Rank: ${rank.toLocaleString()}`, "Restart", () => {
      window.location.reload();
    });
  }
}

// -------------------- Start/Init game --------------------
async function startGame() {
  await loadAllData();

  lives = START_LIVES;
  rank = START_RANK;
  streak = 0;
  milestones = 0;
  currentStageNum = 1;
  setStatsUI();
  setStageLevelText(currentStageNum);

  const submitBtn = el.submitBtn();
  if (submitBtn) {
    submitBtn.onclick = () => {
      submitAnswer();
    };
  }

  startStage(1);
}

window.startGame = startGame;

// Single DOMContentLoaded listener (duplicate removed)
document.addEventListener("DOMContentLoaded", () => {
  const ans = el.answer();
  if (ans) {
    ans.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitAnswer();
      }
    });
  }

  ensureTinyMsg();
  setStatsUI();

  // Start the game automatically
  startGame();
});