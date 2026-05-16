const DEFAULTS = {
  aiGoalMinutes: 30,
  nudgeThresholdMinutes: 10,
  intensity: "medium",
  blocklist: [],
  blockAiInFocus: true,
  muteChime: false,
  customNudges: [],
  onlyCustom: false,
  ghostWriter: true,
  proofOfThought: true,
  aiAllowlist: [
    "chat.openai.com", "chatgpt.com", "claude.ai", "gemini.google.com",
    "bard.google.com", "copilot.microsoft.com", "perplexity.ai",
    "www.perplexity.ai", "grok.com", "chat.deepseek.com", "chat.mistral.ai",
    "huggingface.co", "poe.com", "character.ai", "you.com",
    "chatglm.cn", "kimi.moonshot.cn", "tongyi.aliyun.com"
  ],
  aiPathAllowlist: [
    { host: "x.com", path: "/i/grok" },
    { host: "www.bing.com", path: "/chat" },
    { host: "huggingface.co", path: "/chat" },
  ],
};

async function load() {
  const { settings } = await chrome.storage.local.get("settings");
  const s = { ...DEFAULTS, ...(settings || {}) };
  document.getElementById("aiGoal").value = s.aiGoalMinutes;
  document.getElementById("nudgeThreshold").value = s.nudgeThresholdMinutes;
  document.getElementById("blockAi").checked = !!s.blockAiInFocus;
  document.getElementById("muteChime").checked = !!s.muteChime;
  document.getElementById("blocklist").value = (s.blocklist || []).join("\n");
  document.getElementById("customNudges").value = (s.customNudges || []).join("\n");
  document.getElementById("onlyCustom").checked = !!s.onlyCustom;
  document.getElementById("ghostWriter").checked = !!s.ghostWriter;
  document.getElementById("proofOfThought").checked = !!s.proofOfThought;
  document.getElementById("aiAllowlist").value = (s.aiAllowlist || []).join("\n");
  document.getElementById("aiPathAllowlist").value = (s.aiPathAllowlist || [])
    .map(p => `${p.host} ${p.path}`).join("\n");
  document.querySelectorAll("#intensity button").forEach(b => {
    b.classList.toggle("active", b.dataset.v === s.intensity);
  });
}

document.querySelectorAll("#intensity button").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll("#intensity button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
  });
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  const intensity = document.querySelector("#intensity button.active")?.dataset.v || "medium";
  const blocklist = document.getElementById("blocklist").value
    .split("\n").map(s => s.trim().toLowerCase()).filter(Boolean);
  const customNudges = document.getElementById("customNudges").value
    .split("\n").map(s => s.trim()).filter(Boolean).slice(0, 200);
  const aiAllowlist = document.getElementById("aiAllowlist").value
    .split("\n").map(s => s.trim().toLowerCase()).filter(Boolean);
  const aiPathAllowlist = document.getElementById("aiPathAllowlist").value
    .split("\n").map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) return { host: parts[0].toLowerCase(), path: parts.slice(1).join(" ") };
      return null;
    }).filter(Boolean);
  const settings = {
    aiGoalMinutes: Math.max(1, parseInt(document.getElementById("aiGoal").value, 10) || 30),
    nudgeThresholdMinutes: Math.max(1, parseInt(document.getElementById("nudgeThreshold").value, 10) || 10),
    intensity,
    blocklist,
    blockAiInFocus: document.getElementById("blockAi").checked,
    muteChime: document.getElementById("muteChime").checked,
    customNudges,
    onlyCustom: document.getElementById("onlyCustom").checked,
    ghostWriter: document.getElementById("ghostWriter").checked,
    proofOfThought: document.getElementById("proofOfThought").checked,
    aiAllowlist,
    aiPathAllowlist,
  };
  await chrome.storage.local.set({ settings });
  const tag = document.getElementById("savedTag");
  tag.classList.add("show");
  setTimeout(() => tag.classList.remove("show"), 1500);
});

document.getElementById("exportBtn").addEventListener("click", async () => {
  const all = await chrome.storage.local.get(null);
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const d = new Date();
  a.download = `brainguard-export-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById("resetAllBtn").addEventListener("click", async () => {
  if (!confirm("This will delete all BrainGuard history and settings. Continue?")) return;
  await chrome.storage.local.clear();
  await load();
});

load();
