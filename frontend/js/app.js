/* ═══════════════════════════════════════════════════════════
   PrepAI  —  Frontend Application Logic
   ═══════════════════════════════════════════════════════════ */

const API = "http://localhost:3001/api";

/* ── Role definitions (icon + name) ──────────────────────── */
const ROLES = [
  { name: "Software Engineer",          icon: "⚙️" },
  { name: "Product Manager",            icon: "🗺️" },
  { name: "Data Scientist",             icon: "📊" },
  { name: "UX Designer",                icon: "🎨" },
  { name: "Marketing Manager",          icon: "📣" },
  { name: "DevOps Engineer",            icon: "🚀" },
  { name: "Business Analyst",           icon: "📋" },
  { name: "Data Engineer",              icon: "🔧" },
  { name: "Frontend Developer",         icon: "🖥️" },
  { name: "Backend Developer",          icon: "🗄️" },
  { name: "Machine Learning Engineer",  icon: "🤖" },
  { name: "Project Manager",            icon: "📌" },
];

/* ── Session state ───────────────────────────────────────── */
const S = {
  role       : null,
  difficulty : "entry-level",
  count      : 3,
  questions  : [],
  idx        : 0,
  history    : [],      // { question, answer, feedback | null }
  recording  : false,
  recognition: null,
  transcript : "",
};

/* ── Screen router ───────────────────────────────────────── */
function goTo(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(`screen-${name}`);
  if (!el) return;
  el.classList.add("active");
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
}

/* ── Setup screen ────────────────────────────────────────── */
function showSetup() {
  buildRoles();
  initChips();
  goTo("setup");
}

function buildRoles() {
  const grid = document.getElementById("roles-grid");
  grid.innerHTML = ROLES.map(r => `
    <div class="role-card" id="rc-${slugify(r.name)}" onclick="pickRole('${r.name}')">
      <div class="rc-emoji">${r.icon}</div>
      <div class="rc-name">${r.name}</div>
      <div class="rc-check">✓</div>
    </div>
  `).join("");
}

function initChips() {
  document.querySelectorAll("#diff-chips .chip").forEach(c =>
    c.addEventListener("click", () => {
      document.querySelectorAll("#diff-chips .chip").forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      S.difficulty = c.dataset.v;
    })
  );
  document.querySelectorAll("#cnt-chips .chip").forEach(c =>
    c.addEventListener("click", () => {
      document.querySelectorAll("#cnt-chips .chip").forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      S.count = parseInt(c.dataset.v);
    })
  );
}

function pickRole(name) {
  S.role = name;
  document.querySelectorAll(".role-card").forEach(c => c.classList.remove("selected"));
  document.getElementById(`rc-${slugify(name)}`).classList.add("selected");
  const btn = document.getElementById("start-btn");
  btn.disabled = false;
  document.getElementById("start-lbl").textContent = `Start ${name} Interview`;
  // Animate stepper
  document.getElementById("sn1").classList.add("done");
  document.getElementById("sn2").classList.add("active");
}

/* ── Start session ───────────────────────────────────────── */
async function startSession() {
  if (!S.role) return;
  S.questions = []; S.idx = 0; S.history = [];

  goTo("loading");
  animateLoadSteps();

  try {
    const res = await fetch(`${API}/generate-questions`, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ role: S.role, difficulty: S.difficulty, count: S.count }),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Request failed");

    const data = await res.json();
    S.questions = data.questions;
    await delay(500);
    renderQuestion(0);
    goTo("interview");
  } catch (err) {
    toast(err.message, "err");
    goTo("setup");
  }
}

/* ── Loading steps animation ─────────────────────────────── */
function animateLoadSteps() {
  const ids = ["ls1","ls2","ls3"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = "load-step";
  });
  let i = 0;
  const tick = () => {
    if (i > 0) {
      const prev = document.getElementById(ids[i-1]);
      if (prev) { prev.classList.remove("active"); prev.classList.add("done"); }
    }
    const cur = document.getElementById(ids[i]);
    if (cur) cur.classList.add("active");
    i++;
    if (i < ids.length) setTimeout(tick, 900);
  };
  tick();
}

/* ── Render question ─────────────────────────────────────── */
function renderQuestion(idx) {
  const q     = S.questions[idx];
  const total = S.questions.length;

  document.getElementById("prog-fill").style.width = `${(idx / total) * 100}%`;
  document.getElementById("prog-lbl").textContent  = `Question ${idx+1} of ${total}`;
  document.getElementById("inav-role").textContent  = S.role;

  document.getElementById("q-num").textContent  = String(idx+1).padStart(2,"0");
  document.getElementById("q-text").textContent = q.question;
  document.getElementById("q-cat").textContent  = q.category || "";

  const badge = document.getElementById("q-type");
  badge.textContent = cap(q.type || "general");
  badge.className   = "type-badge";
  if (q.type === "technical")   badge.classList.add("technical");
  if (q.type === "situational") badge.classList.add("situational");

  // Hint
  const hBox = document.getElementById("q-hint-box");
  const hBtn = document.getElementById("btn-hint");
  const hTxt = document.getElementById("q-hint-txt");
  if (q.hint) {
    hTxt.textContent   = q.hint;
    hBox.style.display = "none";
    hBtn.textContent   = "Show Hint";
    hBtn.style.display = "block";
  } else {
    hBtn.style.display = "none";
  }

  // Time guide
  if (q.timeGuide) {
    document.getElementById("q-time-txt").textContent = q.timeGuide;
    document.getElementById("q-time-guide").style.display = "flex";
  } else {
    document.getElementById("q-time-guide").style.display = "none";
  }

  // Reset answer
  document.getElementById("answer-ta").value = "";
  updateWC();
  S.transcript = "";
  document.getElementById("transcript-text").textContent = "";
  document.getElementById("voice-transcript").style.display = "none";
  setTab("text");
  if (S.recording) stopRec();
}

/* ── Hint toggle ─────────────────────────────────────────── */
function toggleHint() {
  const box = document.getElementById("q-hint-box");
  const btn = document.getElementById("btn-hint");
  const vis = box.style.display !== "none";
  box.style.display = vis ? "none" : "flex";
  btn.textContent   = vis ? "Show Hint" : "Hide Hint";
}

/* ── Tab switching ───────────────────────────────────────── */
function setTab(t) {
  document.getElementById("tab-text").classList.toggle("active",  t==="text");
  document.getElementById("tab-voice").classList.toggle("active", t==="voice");
  document.getElementById("panel-text").style.display  = t==="text"  ? "flex" : "none";
  document.getElementById("panel-voice").style.display = t==="voice" ? "flex" : "none";
}

/* ── Word counter ────────────────────────────────────────── */
function updateWC() {
  const v  = document.getElementById("answer-ta").value;
  const wc = v.trim() ? v.trim().split(/\s+/).length : 0;
  const el = document.getElementById("wc");
  el.textContent = `${wc} word${wc!==1?"s":""}`;
  el.className   = "word-ct" + (wc>=150&&wc<=300?" good":wc>300?" over":"");
}
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("answer-ta")?.addEventListener("input", updateWC);
});

/* ── Voice recording ─────────────────────────────────────── */
function toggleRec() { S.recording ? stopRec() : startRec(); }

function startRec() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast("Voice not supported — use Chrome or Edge", "err"); return; }

  const rec = new SR();
  rec.continuous    = true;
  rec.interimResults= true;
  rec.lang          = "en-US";
  S.recognition     = rec;

  rec.onresult = e => {
    let final = S.transcript, interim = "";
    for (let i=e.resultIndex; i<e.results.length; i++) {
      e.results[i].isFinal ? (final += e.results[i][0].transcript+" ") : (interim += e.results[i][0].transcript);
    }
    S.transcript = final;
    document.getElementById("transcript-text").textContent = final + interim;
    document.getElementById("voice-transcript").style.display = "block";
  };

  rec.onerror = () => stopRec();
  rec.onend   = () => { if (S.recording) rec.start(); };
  rec.start();

  S.recording = true;
  document.getElementById("mic-btn").classList.add("rec");
  document.getElementById("voice-wrap").classList.add("rec");
  document.getElementById("mic-status").textContent = "Recording… click to stop";
}

function stopRec() {
  if (S.recognition) { S.recognition.onend = null; S.recognition.stop(); S.recognition = null; }
  S.recording = false;
  document.getElementById("mic-btn").classList.remove("rec");
  document.getElementById("voice-wrap").classList.remove("rec");
  document.getElementById("mic-status").textContent = "Click to start recording";
}

/* ── Get current answer ──────────────────────────────────── */
function getAnswer() {
  return document.getElementById("tab-voice").classList.contains("active")
    ? S.transcript.trim()
    : document.getElementById("answer-ta").value.trim();
}

/* ── Submit answer ───────────────────────────────────────── */
async function submitAnswer() {
  const answer = getAnswer();
  if (!answer || answer.length < 15) {
    toast("In sentences", "err"); return;
  }
  if (S.recording) stopRec();

  const btn = document.getElementById("btn-submit");
  btn.disabled = true;
  btn.innerHTML = `<span>Analysing…</span>`;

  try {
    const q   = S.questions[S.idx];
    const res = await fetch(`${API}/analyze-answer`, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ role: S.role, question: q.question, questionType: q.type, answer }),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Analysis failed");

    const fb = await res.json();
    S.history.push({ question: q, answer, feedback: fb });
    showFeedback(fb, q);
  } catch (err) {
    toast(err.message, "please write at least a few sentences first");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Analyse Answer <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
  }
}

function skipQ() {
  S.history.push({ question: S.questions[S.idx], answer: "[Skipped]", feedback: null });
  advance();
}

/* ── Render feedback ─────────────────────────────────────── */
function showFeedback(fb, q) {
  const idx   = S.idx;
  const total = S.questions.length;
  const isLast= idx === total - 1;

  document.getElementById("fb-lbl").textContent  = `Feedback · Q${idx+1} of ${total}`;
  document.getElementById("fb-role").textContent  = S.role;

  /* Score ring */
  const scoreColor  = fb.overallScore>=75?"var(--green)":fb.overallScore>=50?"var(--amber)":"var(--red)";
  const circ        = 2*Math.PI*58;
  const dashOffset  = circ - (fb.overallScore/100)*circ;

  /* Verdict CSS class */
  const verdictClass= {
    "Exceptional":"v-exceptional","Strong":"v-strong","Good":"v-good",
    "Needs Work":"v-needs-work","Poor":"v-poor"
  }[fb.verdict]||"v-needs-work";

  const metCol = s => s>=75?"var(--green)":s>=50?"var(--amber)":"var(--red)";

  document.getElementById("fb-wrap").innerHTML = `

    <div class="fb-q-card">
      <div class="fb-q-lbl">Question ${idx+1} · ${cap(q.type||"General")}</div>
      <div class="fb-q-txt">${esc(q.question)}</div>
    </div>

    <div class="fb-overall">
      <div class="score-ring-wrap">
        <svg class="sr-svg" viewBox="0 0 130 130">
          <circle class="sr-bg" cx="65" cy="65" r="58"/>
          <circle class="sr-fill" cx="65" cy="65" r="58"
            stroke="${scoreColor}"
            stroke-dasharray="${circ}"
            stroke-dashoffset="${circ}"
            id="sr-anim"/>
        </svg>
        <div class="score-overlay">
          <span class="score-big" style="color:${scoreColor}">${fb.overallScore}</span>
          <span class="score-of">/100</span>
        </div>
      </div>
      <div>
        <div class="verdict ${verdictClass}">${fb.verdict}</div>
        <p class="fb-summary">${esc(fb.summary)}</p>
      </div>
    </div>

    <div class="metrics-grid">
      ${Object.values(fb.scores||{}).map(s=>`
        <div class="metric-card">
          <div class="mc-top">
            <span class="mc-lbl">${esc(s.label)}</span>
            <span class="mc-val" style="color:${metCol(s.score)}">${s.score}</span>
          </div>
          <div class="mc-track">
            <div class="mc-bar" data-w="${s.score}%" style="background:${metCol(s.score)}"></div>
          </div>
          <div class="mc-fb">${esc(s.feedback)}</div>
        </div>
      `).join("")}
    </div>

    <div class="two-col">
      <div class="list-card">
        <div class="list-card-title"><span>💪</span> Strengths</div>
        <ul class="item-list strengths-list">
          ${(fb.strengths||[]).map(s=>`<li><span class="dot">✓</span>${esc(s)}</li>`).join("")}
        </ul>
      </div>
      <div class="list-card">
        <div class="list-card-title"><span>📈</span> Areas to Improve</div>
        <ul class="item-list improvements-list">
          ${(fb.improvements||[]).map(s=>`<li><span class="dot">↑</span>${esc(s)}</li>`).join("")}
        </ul>
      </div>
    </div>

    ${fb.modelAnswer?`
    <div class="model-card">
      <div class="model-hdr"><span>⭐</span> Model Answer</div>
      <p class="model-text">${esc(fb.modelAnswer)}</p>
    </div>`:""}

    ${fb.keywords&&fb.keywords.length?`
    <div class="kw-section">
      <div class="kw-lbl">Key Concepts to Reference</div>
      <div class="kw-list">${fb.keywords.map(k=>`<span class="kw">${esc(k)}</span>`).join("")}</div>
    </div>`:""}

    <div class="fb-actions">
      <button class="btn btn-ghost" onclick="retryQ()">↩ Try Again</button>
      ${isLast
        ? `<button class="btn btn-gold btn-xl" onclick="showResults()">View Session Results ✨</button>`
        : `<button class="btn btn-primary" onclick="nextQ()">Next Question →</button>`}
    </div>
  `;

  goTo("feedback");

  /* Animate ring */
  requestAnimationFrame(()=>setTimeout(()=>{
    const ring = document.getElementById("sr-anim");
    if (ring) ring.style.strokeDashoffset = dashOffset;
    document.querySelectorAll(".mc-bar[data-w]").forEach(b=>{
      setTimeout(()=>{ b.style.width = b.dataset.w; },200);
    });
  },100));
}

function retryQ()  { S.history.pop(); renderQuestion(S.idx); goTo("interview"); }
function nextQ()   { S.idx++; renderQuestion(S.idx); goTo("interview"); }
function advance() { S.idx>=S.questions.length-1 ? showResults() : (S.idx++,renderQuestion(S.idx),goTo("interview")); }

/* ── Session results ─────────────────────────────────────── */
function showResults() {
  const answered = S.history.filter(h=>h.feedback);
  const avg = k => {
    const vals = answered.filter(h=>h.feedback?.scores?.[k]);
    return vals.length ? Math.round(vals.reduce((s,h)=>s+h.feedback.scores[k].score,0)/vals.length) : 0;
  };
  const overall = answered.length
    ? Math.round(answered.reduce((s,h)=>s+h.feedback.overallScore,0)/answered.length) : 0;

  const trophy = overall>=80?"🏆":overall>=60?"🎯":overall>=40?"💪":"📚";
  const title  = overall>=80?"Outstanding!":overall>=60?"Great Work!":overall>=40?"Keep Practising!":"Room to Grow";

  document.getElementById("results-wrap").innerHTML = `
    <span class="trophy">${trophy}</span>
    <h1 class="results-h1">${title}</h1>
    <p class="results-sub">
      Completed <strong>${S.questions.length} questions</strong> for
      <strong>${S.role}</strong> — ${cap(S.difficulty)}
    </p>
    <div class="results-grid">
      <div class="rg-cell"><span class="rg-num">${overall}</span><span class="rg-lbl">Overall</span></div>
      <div class="rg-cell"><span class="rg-num">${avg("clarity")}</span><span class="rg-lbl">Clarity</span></div>
      <div class="rg-cell"><span class="rg-num">${avg("depth")}</span><span class="rg-lbl">Depth</span></div>
      <div class="rg-cell"><span class="rg-num">${avg("relevance")}</span><span class="rg-lbl">Relevance</span></div>
    </div>
    <div class="results-actions">
      <button class="btn btn-ghost btn-xl" onclick="showSetup()">New Role</button>
      <button class="btn btn-gold btn-xl" onclick="startSession()">
        Practise Again
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
      </button>
    </div>
  `;
  goTo("results");
}

/* ── Exit modal ──────────────────────────────────────────── */
function confirmExit() { document.getElementById("exit-overlay").style.display="flex"; }
function closeModal()  { document.getElementById("exit-overlay").style.display="none"; }
function doExit()      { closeModal(); if(S.recording)stopRec(); showSetup(); }

/* ── Toast ───────────────────────────────────────────────── */
let _toastTimer;
function toast(msg, type = "") {
  if (!msg || !String(msg).trim()) return;
  const el  = document.getElementById("toast");
  const txt = document.getElementById("toast-msg");
  clearTimeout(_toastTimer);
  el.classList.remove("show", "err", "ok");
  txt.textContent = "";
  void el.offsetWidth;
  txt.textContent = String(msg);
  el.classList.add("show");
  if (type) el.classList.add(type);
  _toastTimer = setTimeout(() => {
    el.classList.remove("show", "err", "ok");
  }, 3500);
}

/* ── Helpers ─────────────────────────────────────────────── */
const cap     = s => s ? s.charAt(0).toUpperCase()+s.slice(1).replace(/-/g," ") : "";
const slugify = s => s.replace(/\s+/g,"_").replace(/[^a-zA-Z0-9_]/g,"");
const esc     = s => (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const delay   = ms => new Promise(r=>setTimeout(r,ms));
