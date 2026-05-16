// BrainGuard background service worker
// Tracks active tab time, AI usage, daily goals, streaks, and focus mode.

const DEFAULT_AI_HOSTS = [
  "chat.openai.com", "chatgpt.com", "claude.ai", "gemini.google.com",
  "bard.google.com", "copilot.microsoft.com", "perplexity.ai",
  "www.perplexity.ai", "grok.com", "chat.deepseek.com", "chat.mistral.ai",
  "huggingface.co", "poe.com", "character.ai", "you.com",
  "chatglm.cn", "kimi.moonshot.cn", "tongyi.aliyun.com"
];

const DEFAULT_AI_PATH_HINTS = [
  { host: "x.com", path: "/i/grok" },
  { host: "www.bing.com", path: "/chat" },
  { host: "huggingface.co", path: "/chat" },
];

const TICK_SECONDS = 30;       // alarm period (Chrome MV3 min is 30s)
const MAX_TICK_SECONDS = 60;   // cap delta if SW was asleep / system was idle

const DEFAULT_SETTINGS = {
  aiGoalMinutes: 30,             // daily AI minute goal
  nudgeThresholdMinutes: 10,     // when toasts start
  intensity: "medium",           // "gentle" | "medium" | "strict"
  blocklist: [],                 // additional hosts to block in focus mode
  blockAiInFocus: true,          // block all AI hosts in focus mode
  muteChime: false,              // mute pomodoro phase-end chime
  customNudges: [],              // user-defined nudge messages
  onlyCustom: false,             // if true, ignore built-in nudges
  ghostWriter: true,             // blur + intent gate when over daily limit
  proofOfThought: true,          // puzzle gate when over daily limit
  aiAllowlist: [...DEFAULT_AI_HOSTS],
  aiPathAllowlist: [...DEFAULT_AI_PATH_HINTS],
};

let state = {
  activeTabId: null,
  activeUrl: null,
  windowFocused: true,
  focus: { active: false, until: 0 },
  pomo: null,
};

const POMO_DEFAULT = { workMin: 25, breakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4 };

function todayKey() {
  const d = new Date();
  return `stats:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function isAiUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const settings = await getSettings();
    const hosts = settings.aiAllowlist || DEFAULT_AI_HOSTS;
    const paths = settings.aiPathAllowlist || DEFAULT_AI_PATH_HINTS;
    if (hosts.includes(u.hostname)) return true;
    return paths.some(h => u.hostname === h.host && u.pathname.startsWith(h.path));
  } catch { return false; }
}

function hostFromUrl(url) {
  try { return new URL(url).hostname; } catch { return null; }
}

async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

async function loadDay() {
  const key = todayKey();
  const data = await chrome.storage.local.get(key);
  const day = data[key] || {
    totalSec: 0, aiSec: 0, perSite: {}, aiPrompts: 0,
    lastInterventionSec: 0, interventionCount: 0,
    promptCategories: { "direct-answer": 0, explanation: 0, reflective: 0, brainstorm: 0, refinement: 0 },
  };
  if (!day.promptCategories) {
    day.promptCategories = { "direct-answer": 0, explanation: 0, reflective: 0, brainstorm: 0, refinement: 0 };
  }
  return day;
}

async function saveDay(day) {
  await chrome.storage.local.set({ [todayKey()]: day });
}

async function getFocus() {
  const { focus } = await chrome.storage.local.get("focus");
  const f = focus || { active: false, until: 0 };
  if (f.active && f.until && Date.now() > f.until) {
    f.active = false; f.until = 0;
    await chrome.storage.local.set({ focus: f });
  }
  state.focus = f;
  return f;
}

async function setFocus(active, minutes) {
  const focus = active
    ? { active: true, until: Date.now() + minutes * 60 * 1000, startedAt: Date.now(), durationMin: minutes }
    : { active: false, until: 0 };
  state.focus = focus;
  await chrome.storage.local.set({ focus });
  return focus;
}

async function updateStreak(day, settings) {
  // Streak = consecutive days you stayed under aiGoalMinutes.
  // We freeze "yesterday's" outcome the first time we tick on a new day.
  const { streak } = await chrome.storage.local.get("streak");
  const s = streak || { current: 0, best: 0, lastDate: null };
  const todayD = dateStr(new Date());
  if (s.lastDate !== todayD) {
    // evaluate the previous lastDate's outcome
    if (s.lastDate) {
      const prev = await chrome.storage.local.get(`stats:${s.lastDate}`);
      const prevDay = prev[`stats:${s.lastDate}`];
      const prevAiMin = prevDay ? prevDay.aiSec / 60 : 0;
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const wasYesterday = s.lastDate === dateStr(yesterday);
      if (wasYesterday && prevAiMin <= settings.aiGoalMinutes) {
        s.current += 1;
      } else {
        s.current = 0;
      }
      s.best = Math.max(s.best, s.current);
    }
    s.lastDate = todayD;
    await chrome.storage.local.set({ streak: s });
  }
  return s;
}

function interventionCadenceSec(intensity) {
  if (intensity === "gentle") return 300;
  if (intensity === "strict") return 90;
  return 180;
}

async function tick() {
  const now = Date.now();
  const { lastTickAt } = await chrome.storage.local.get("lastTickAt");
  const prev = lastTickAt || now;
  let delta = Math.round((now - prev) / 1000);
  await chrome.storage.local.set({ lastTickAt: now });

  if (!state.windowFocused || !state.activeUrl) return;
  const url = state.activeUrl;
  const host = hostFromUrl(url);
  if (!host || url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("edge://")) return;

  // Cap delta so a long sleep / system suspend doesn't dump huge time onto current tab.
  if (delta < 1) delta = 1;
  if (delta > MAX_TICK_SECONDS) delta = MAX_TICK_SECONDS;

  const settings = await getSettings();
  const day = await loadDay();
  await updateStreak(day, settings);

  day.totalSec += delta;
  day.perSite[host] = (day.perSite[host] || 0) + delta;
  const ai = await isAiUrl(url);
  if (ai) day.aiSec += delta;
  await saveDay(day);

  const aiMin = day.aiSec / 60;
  const cadence = interventionCadenceSec(settings.intensity);

  const overGoal = aiMin > settings.aiGoalMinutes;
  const justCrossedGoal = ai && overGoal && (day.aiSec - delta) / 60 <= settings.aiGoalMinutes;

  if (ai && aiMin >= settings.nudgeThresholdMinutes) {
    if (justCrossedGoal || day.aiSec - day.lastInterventionSec >= cadence || day.lastInterventionSec === 0) {
      day.lastInterventionSec = day.aiSec;
      day.interventionCount = (day.interventionCount || 0) + 1;
      await saveDay(day);
      try {
        await chrome.tabs.sendMessage(state.activeTabId, {
          type: "BRAINGUARD_NUDGE",
          aiMinutes: Math.round(aiMin),
          goalMinutes: settings.aiGoalMinutes,
          intensity: settings.intensity,
          overGoal,
          customNudges: settings.customNudges || [],
          onlyCustom: !!settings.onlyCustom,
          ghostWriter: !!settings.ghostWriter,
          proofOfThought: !!settings.proofOfThought,
        });
      } catch { /* no content script on page */ }
    }
  }
}

async function maybeBlockTab(tabId, url) {
  const focus = await getFocus();
  if (!focus.active) return;
  const settings = await getSettings();
  const host = hostFromUrl(url);
  if (!host) return;
  const isAi = await isAiUrl(url);
  const blocked = (settings.blockAiInFocus && isAi) || (settings.blocklist || []).includes(host);
  if (!blocked) return;
  const remaining = Math.max(0, focus.until - Date.now());
  const blockUrl = chrome.runtime.getURL(`blocked.html?host=${encodeURIComponent(host)}&until=${focus.until}&remaining=${remaining}`);
  try { await chrome.tabs.update(tabId, { url: blockUrl }); } catch {}
}

async function updateActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) {
      state.activeTabId = tab.id;
      state.activeUrl = tab.url;
      maybeBlockTab(tab.id, tab.url);
    } else {
      state.activeTabId = null;
      state.activeUrl = null;
    }
  } catch { /* ignore */ }
}

/* ---------- Dynamic content-script registration ---------- */
async function registerAiScripts() {
  try {
    const settings = await getSettings();
    const hosts = settings.aiAllowlist || DEFAULT_AI_HOSTS;
    const paths = settings.aiPathAllowlist || DEFAULT_AI_PATH_HINTS;

    const matches = [
      ...hosts.map(h => `*://${h}/*`),
      ...paths.map(p => `*://${p.host}${p.path}*`),
    ];
    const unique = [...new Set(matches)];

    // Unregister previous version if any
    try {
      await chrome.scripting.unregisterContentScripts({ ids: ["brainguard-ai"] });
    } catch {}

    await chrome.scripting.registerContentScripts([{
      id: "brainguard-ai",
      matches: unique,
      js: ["content.js"],
      css: ["content.css"],
      runAt: "document_idle",
    }]);
  } catch (e) {
    console.error("BrainGuard: failed to register AI content scripts", e);
  }
}

// Re-register when the allowlist changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings?.newValue) {
    const old = changes.settings.oldValue || {};
    const neu = changes.settings.newValue;
    const listChanged =
      JSON.stringify(old.aiAllowlist) !== JSON.stringify(neu.aiAllowlist) ||
      JSON.stringify(old.aiPathAllowlist) !== JSON.stringify(neu.aiPathAllowlist);
    if (listChanged) registerAiScripts();
  }
});

chrome.tabs.onActivated.addListener(async () => { await tick(); await updateActiveTab(); });
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (tabId === state.activeTabId && info.url) { await tick(); state.activeUrl = info.url; }
  if (info.status === "loading" && tab?.url) maybeBlockTab(tabId, tab.url);
});
chrome.windows.onFocusChanged.addListener(async (winId) => {
  await tick();
  state.windowFocused = winId !== chrome.windows.WINDOW_ID_NONE;
  if (state.windowFocused) await updateActiveTab();
});

/* ---------------- POMODORO ---------------- */
async function getPomo() {
  const { pomo } = await chrome.storage.local.get("pomo");
  let p = pomo || null;
  if (p && p.phaseUntil && Date.now() > p.phaseUntil) {
    p = await advancePomo(p);
  }
  state.pomo = p;
  return p;
}

async function savePomo(p) {
  state.pomo = p;
  if (p) await chrome.storage.local.set({ pomo: p });
  else await chrome.storage.local.remove("pomo");
  updateBadge();
}

async function startPomo(cfg) {
  const c = { ...POMO_DEFAULT, ...(cfg || {}) };
  const p = {
    ...c,
    phase: "work",
    cycle: 1,
    phaseUntil: Date.now() + c.workMin * 60 * 1000,
    startedAt: Date.now(),
  };
  await savePomo(p);
  return p;
}

async function advancePomo(p) {
  let next, variant;
  if (p.phase === "work") {
    const isLong = p.cycle % p.cyclesBeforeLong === 0;
    next = { ...p, phase: isLong ? "longBreak" : "break",
             phaseUntil: Date.now() + (isLong ? p.longBreakMin : p.breakMin) * 60 * 1000 };
    notify("Break time", isLong ? `Long break — ${p.longBreakMin} min. Step away.` : `Short break — ${p.breakMin} min.`);
    variant = "break";
  } else {
    next = { ...p, phase: "work", cycle: p.cycle + 1,
             phaseUntil: Date.now() + p.workMin * 60 * 1000 };
    notify("Back to work", `Cycle ${next.cycle} · ${p.workMin} min focus.`);
    variant = "work";
  }
  await savePomo(next);
  playChime(variant);
  return next;
}

async function stopPomo() {
  await savePomo(null);
  chrome.action.setBadgeText({ text: "" });
}

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon.png"),
      title, message, priority: 1,
    });
  } catch {}
}

/* ---------- Chime via offscreen document ---------- */
async function ensureOffscreen() {
  try {
    if (chrome.offscreen?.hasDocument && await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("offscreen.html"),
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play soft chime when a Pomodoro phase ends.",
    });
  } catch (e) { /* already exists or unsupported */ }
}

async function playChime(variant) {
  try {
    const settings = await getSettings();
    if (settings.muteChime) return;
    await ensureOffscreen();
    chrome.runtime.sendMessage({ type: "BRAINGUARD_PLAY_CHIME", variant });
  } catch {}
}

async function updateBadge() {
  const p = state.pomo;
  if (!p || !p.phaseUntil) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  const remaining = Math.max(0, p.phaseUntil - Date.now());
  const totalSec = Math.ceil(remaining / 1000);
  const min = Math.ceil(totalSec / 60);
  const text = totalSec <= 60 ? `${totalSec}s` : `${min}m`;
  const color = p.phase === "work" ? "#7c3aed" : "#10b981";
  chrome.action.setBadgeBackgroundColor({ color });
  try { chrome.action.setBadgeTextColor({ color: "#ffffff" }); } catch {}
  chrome.action.setBadgeText({ text });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "BRAINGUARD_PROMPT_SENT") {
      const day = await loadDay();
      day.aiPrompts += 1;
      const cat = msg.category && day.promptCategories[msg.category] !== undefined ? msg.category : "direct-answer";
      day.promptCategories[cat] = (day.promptCategories[cat] || 0) + 1;
      await saveDay(day);
      sendResponse({ ok: true, category: cat });
    } else if (msg?.type === "BRAINGUARD_START_FOCUS") {
      const f = await setFocus(true, msg.minutes || 25);
      await updateActiveTab();
      sendResponse({ ok: true, focus: f });
    } else if (msg?.type === "BRAINGUARD_END_FOCUS") {
      const f = await setFocus(false, 0);
      sendResponse({ ok: true, focus: f });
    } else if (msg?.type === "BRAINGUARD_START_POMO") {
      const p = await startPomo(msg.config);
      sendResponse({ ok: true, pomo: p });
    } else if (msg?.type === "BRAINGUARD_STOP_POMO") {
      await stopPomo();
      sendResponse({ ok: true });
    } else if (msg?.type === "BRAINGUARD_SKIP_POMO") {
      const cur = await getPomo();
      if (cur) { const next = await advancePomo({ ...cur, phaseUntil: Date.now() }); sendResponse({ ok: true, pomo: next }); }
      else sendResponse({ ok: false });
    } else if (msg?.type === "BRAINGUARD_GET_STATE") {
      const [day, settings, focus, pomo] = await Promise.all([loadDay(), getSettings(), getFocus(), getPomo()]);
      const { streak } = await chrome.storage.local.get("streak");
      sendResponse({ day, settings, focus, pomo, streak: streak || { current: 0, best: 0, lastDate: null } });
    }
  })();
  return true;
});

chrome.alarms.create("brainguard-tick", { periodInMinutes: TICK_SECONDS / 60 });
chrome.alarms.create("brainguard-pomo", { periodInMinutes: 0.25 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "brainguard-tick") tick();
  if (a.name === "brainguard-pomo") getPomo().then(updateBadge);
});

// Faster badge updates while service worker is alive
setInterval(() => { getPomo().then(updateBadge); }, 1000);

chrome.runtime.onInstalled.addListener((details) => {
  updateActiveTab();
  getPomo().then(updateBadge);
  registerAiScripts();
  if (details.reason === "install") {
    // Open the options page so the user immediately sees BrainGuard is installed.
    try { chrome.runtime.openOptionsPage(); } catch {}
  }
});
chrome.runtime.onStartup.addListener(() => { updateActiveTab(); getPomo().then(updateBadge); registerAiScripts(); });
updateActiveTab();
getPomo().then(updateBadge);
registerAiScripts();
