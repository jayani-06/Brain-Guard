const AI_HOSTS = new Set([
  "chat.openai.com","chatgpt.com","claude.ai","gemini.google.com","bard.google.com",
  "copilot.microsoft.com","perplexity.ai","www.perplexity.ai","grok.com",
  "chat.deepseek.com","chat.mistral.ai","huggingface.co","poe.com","character.ai",
  "you.com","chatglm.cn","kimi.moonshot.cn","tongyi.aliyun.com","x.com","www.bing.com"
]);

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayKey() { return `stats:${dateStr(new Date())}`; }
function fmt(sec) {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60), h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}
function fmtMin(min) {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60); return `${h}h ${Math.round(min % 60)}m`;
}

let CURRENT_SETTINGS = { aiGoalMinutes: 30, nudgeThresholdMinutes: 10, intensity: "medium" };

async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return { aiGoalMinutes: 30, nudgeThresholdMinutes: 10, intensity: "medium", ...(settings || {}) };
}
async function getStreak() {
  const { streak } = await chrome.storage.local.get("streak");
  return streak || { current: 0, best: 0, lastDate: null };
}
async function getFocus() {
  const { focus } = await chrome.storage.local.get("focus");
  return focus || { active: false, until: 0 };
}

/* ---------------- TODAY ---------------- */
async function renderToday() {
  const key = todayKey();
  const data = await chrome.storage.local.get(key);
  const day = data[key] || { totalSec: 0, aiSec: 0, perSite: {}, aiPrompts: 0 };
  const settings = CURRENT_SETTINGS;
  const streak = await getStreak();

  document.getElementById("todayLabel").textContent =
    new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  document.getElementById("totalTime").textContent = fmt(day.totalSec);
  document.getElementById("aiTime").textContent = fmt(day.aiSec);
  document.getElementById("aiPrompts").textContent = day.aiPrompts || 0;

  const pct = day.totalSec ? Math.round((day.aiSec / day.totalSec) * 100) : 0;
  document.getElementById("aiPct").textContent = pct + "%";

  const totalPct = Math.min(100, (day.totalSec / (4 * 3600)) * 100);
  const aiPct = Math.min(100, (day.aiSec / (settings.aiGoalMinutes * 60)) * 100);
  document.getElementById("totalBar").style.width = totalPct + "%";
  document.getElementById("aiBar").style.width = aiPct + "%";

  const aiMin = day.aiSec / 60;
  document.getElementById("goalText").textContent = `Goal: ${settings.aiGoalMinutes} min`;
  const stateEl = document.getElementById("goalState");
  if (aiMin > settings.aiGoalMinutes) { stateEl.className = "goal-state over"; stateEl.textContent = "over goal"; }
  else if (aiMin > settings.aiGoalMinutes * 0.7) { stateEl.className = "goal-state warn"; stateEl.textContent = "close"; }
  else { stateEl.className = "goal-state ok"; stateEl.textContent = "on track"; }

  document.getElementById("streakNum").textContent = streak.current;
  document.getElementById("bestStreak").textContent = streak.best;

  const sites = Object.entries(day.perSite || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 8);
  const list = document.getElementById("sites");
  list.innerHTML = "";
  if (sites.length === 0) {
    list.innerHTML = '<div class="empty">No activity yet today.</div>';
  } else {
    for (const [host, sec] of sites) {
      const isAi = AI_HOSTS.has(host);
      const row = document.createElement("div");
      row.className = "site" + (isAi ? " ai" : "");
      row.innerHTML = `<div class="h"><span class="pill"></span><span class="name"></span></div><div class="t"></div>`;
      row.querySelector(".name").textContent = host;
      row.querySelector(".t").textContent = fmt(sec);
      list.appendChild(row);
    }
  }
}

/* ---------------- HISTORY ---------------- */
async function renderHistory() {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    days.push(d);
  }
  const keys = days.map(d => `stats:${dateStr(d)}`);
  const data = await chrome.storage.local.get(keys);

  const items = days.map(d => {
    const k = `stats:${dateStr(d)}`;
    const v = data[k] || { totalSec: 0, aiSec: 0, aiPrompts: 0 };
    return { date: d, ...v };
  });

  const totalSum = items.reduce((s, x) => s + x.totalSec, 0);
  const aiSum = items.reduce((s, x) => s + x.aiSec, 0);
  const promptSum = items.reduce((s, x) => s + (x.aiPrompts || 0), 0);
  const avgAi = aiSum / 7;

  document.getElementById("histSummary").innerHTML =
    `<div>Total<strong>${fmt(totalSum)}</strong></div>` +
    `<div>AI<strong>${fmt(aiSum)}</strong></div>` +
    `<div>Avg AI/day<strong>${fmtMin(avgAi/60)}</strong></div>` +
    `<div>Prompts<strong>${promptSum}</strong></div>`;

  const maxSec = Math.max(60, ...items.map(x => x.totalSec));
  const chart = document.getElementById("chart");
  chart.innerHTML = "";
  for (const x of items) {
    const totalH = (x.totalSec / maxSec) * 90;
    const aiH    = (x.aiSec    / maxSec) * 90;
    const nonAiH = Math.max(0, totalH - aiH);
    const dayLabel = x.date.toLocaleDateString(undefined, { weekday: "short" })[0];
    const col = document.createElement("div");
    col.className = "col";
    col.innerHTML = `
      <div class="stack" title="${fmt(x.totalSec)} total / ${fmt(x.aiSec)} AI">
        <div class="b-ai"    style="height:${aiH}px"></div>
        <div class="b-total" style="height:${nonAiH}px"></div>
      </div>
      <div class="lbl-x">${dayLabel}</div>`;
    chart.appendChild(col);
  }

  const list = document.getElementById("histList");
  list.innerHTML = "";
  for (let i = items.length - 1; i >= 0; i--) {
    const x = items[i];
    const label = x.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const row = document.createElement("div");
    row.className = "site";
    row.innerHTML = `<div class="h"><span class="pill"></span><span class="name"></span></div><div class="t"></div>`;
    row.querySelector(".name").textContent = label;
    row.querySelector(".t").textContent = `${fmt(x.totalSec)} · AI ${fmt(x.aiSec)}`;
    list.appendChild(row);
  }
}

/* ---------------- FOCUS ---------------- */
let focusTimer = null;
async function renderFocus() {
  const f = await getFocus();
  const stateEl = document.getElementById("focusState");
  const subEl = document.getElementById("focusSub");
  const opts = document.getElementById("focusOptions");
  const endBtn = document.getElementById("endFocusBtn");
  if (focusTimer) { clearInterval(focusTimer); focusTimer = null; }

  if (f.active && f.until > Date.now()) {
    const update = () => {
      const remaining = Math.max(0, f.until - Date.now());
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      stateEl.textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
      if (remaining <= 0) { renderFocus(); }
    };
    update();
    focusTimer = setInterval(update, 1000);
    subEl.textContent = "Blocking AI sites. Stay sharp.";
    opts.style.display = "none";
    endBtn.style.display = "block";
  } else {
    stateEl.textContent = "Off";
    subEl.textContent = "Block AI sites and stay sharp.";
    opts.style.display = "grid";
    endBtn.style.display = "none";
  }
  renderPomo();
}

/* ---------------- POMODORO ---------------- */
let pomoTimer = null;
async function getPomo() {
  const { pomo } = await chrome.storage.local.get("pomo");
  return pomo || null;
}
function phaseLabel(p) {
  if (p.phase === "work") return `Work · cycle ${p.cycle}`;
  if (p.phase === "longBreak") return `Long break · cycle ${p.cycle}`;
  return `Break · cycle ${p.cycle}`;
}
async function renderPomo() {
  const p = await getPomo();
  const stateEl = document.getElementById("pomoState");
  const phaseEl = document.getElementById("pomoPhase");
  const subEl = document.getElementById("pomoSub");
  const cfg = document.getElementById("pomoConfig");
  const acts = document.getElementById("pomoActions");
  if (pomoTimer) { clearInterval(pomoTimer); pomoTimer = null; }

  if (p && p.phaseUntil > Date.now()) {
    const update = () => {
      const remaining = Math.max(0, p.phaseUntil - Date.now());
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      stateEl.textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
      if (remaining <= 0) setTimeout(renderPomo, 600);
    };
    update();
    pomoTimer = setInterval(update, 1000);
    phaseEl.textContent = phaseLabel(p);
    subEl.textContent = p.phase === "work"
      ? `Heads down. ${p.workMin}-min focus block.`
      : `Rest your eyes. Long break every ${p.cyclesBeforeLong} cycles.`;
    cfg.style.display = "none";
    acts.style.display = "flex";
  } else {
    stateEl.textContent = "--:--";
    phaseEl.textContent = "Idle";
    subEl.textContent = "Work / break cycles with a badge countdown.";
    cfg.style.display = "block";
    acts.style.display = "none";
  }
}

/* ---------------- WIRE UP ---------------- */
function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
      const target = btn.dataset.tab;
      document.querySelectorAll(".pane").forEach(p => p.classList.toggle("active", p.dataset.pane === target));
      if (target === "history") renderHistory();
      if (target === "focus") renderFocus();
    });
  });
}

document.getElementById("resetBtn").addEventListener("click", async () => {
  await chrome.storage.local.set({ [todayKey()]: { totalSec: 0, aiSec: 0, perSite: {}, aiPrompts: 0, lastInterventionSec: 0, interventionCount: 0 } });
  renderToday();
});

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.querySelectorAll(".chip").forEach(btn => {
  btn.addEventListener("click", async () => {
    const minutes = parseInt(btn.dataset.min, 10);
    await chrome.runtime.sendMessage({ type: "BRAINGUARD_START_FOCUS", minutes });
    renderFocus();
  });
});
document.getElementById("endFocusBtn").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "BRAINGUARD_END_FOCUS" });
  renderFocus();
});

document.getElementById("startPomoBtn").addEventListener("click", async () => {
  const config = {
    workMin: parseInt(document.getElementById("pomoWork").value, 10),
    breakMin: parseInt(document.getElementById("pomoBreak").value, 10),
    longBreakMin: parseInt(document.getElementById("pomoLong").value, 10),
    cyclesBeforeLong: 4,
  };
  await chrome.runtime.sendMessage({ type: "BRAINGUARD_START_POMO", config });
  renderPomo();
});
document.getElementById("stopPomoBtn").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "BRAINGUARD_STOP_POMO" });
  renderPomo();
});
document.getElementById("skipPomoBtn").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "BRAINGUARD_SKIP_POMO" });
  renderPomo();
});

(async function init() {
  setupTabs();
  CURRENT_SETTINGS = await getSettings();
  await renderToday();
  setInterval(renderToday, 5000);
})();
