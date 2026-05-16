// BrainGuard content script: counts AI prompts + shows toast/overlay nudges.

const NUDGES_GENTLE = [
  "Friendly reminder that you have a brain. Use it.",
  "Maybe try thinking first. The AI will still be here.",
  "Quick check-in: do you actually need this prompt?",
  "Pause. Breathe. Then decide if you need the AI.",
  "You've solved harder things without help.",
  "Your future self called. They want the credit.",
  "What would you do if the wifi died right now?",
  "Tiny experiment: try one sentence on your own.",
  "Curiosity over convenience. Just this once.",
  "The blank page is not your enemy.",
];
const NUDGES_MEDIUM = [
  "Maybe use that brain of yours for this one.",
  "Your neurons called. They want a turn.",
  "Plot twist: you might already know the answer.",
  "Step away from the AI. Slowly.",
  "Are you the one prompting, or the one being trained?",
  "Ten minutes in. Time for a human thought?",
  "Your brain is not a vestigial organ. Yet.",
  "Imagine explaining this prompt to your grandma.",
  "If thinking was a muscle, yours just skipped leg day.",
  "The AI is not your therapist, parent, or oracle.",
  "Roses are red, violets are blue, maybe just google it before asking GPT to.",
  "Achievement unlocked: 47 prompts, 0 original thoughts.",
  "You used to know things. Remember that?",
];
const NUDGES_PREPROMPT = [
  "Don't you want to try this on your own first?",
  "Wait — give it 30 seconds of your own brain before asking.",
  "What's your first guess? Type that instead.",
  "Pop quiz: could you answer this without AI?",
  "Hey, just checking — is this a 'you' problem or an AI one?",
  "Try writing one sentence yourself before hitting send.",
  "Your brain wants in on this. Let it try.",
  "Sketch the answer first. Then ask if you're stuck.",
  "Outline it in your head before outsourcing it.",
  "Future-you remembers what you actually figured out.",
];
const NUDGES_STRICT = [
  "Stop. Think. Then maybe ask.",
  "Even ChatGPT is tired of you. Take a breather.",
  "Outsource your laundry, not your thinking.",
  "This is your brain on autopilot. Take the wheel.",
  "Close this tab for 5 minutes. You'll survive.",
  "Cognitive offloading detected. Initiating shame protocol.",
  "Your search history is a cry for help. Answer it yourself.",
  "If you prompt one more time, a philosopher cries.",
  "The robots are watching you outsource your soul.",
  "Plot twist: the AI was you all along. (No it wasn't. Think.)",
  "You are one prompt away from forgetting your own name.",
  "Sam Altman just felt a disturbance in the force. It was you.",
  "Touch grass. Not the keyboard. Grass.",
];

function pickNudge(intensity, customNudges, onlyCustom) {
  const builtIn = intensity === "gentle" ? NUDGES_GENTLE
                : intensity === "strict" ? NUDGES_STRICT
                : NUDGES_MEDIUM;
  const custom = Array.isArray(customNudges) ? customNudges.filter(Boolean) : [];
  const pool = onlyCustom && custom.length ? custom : [...builtIn, ...custom];
  return pool[Math.floor(Math.random() * pool.length)];
}

function showToast(message, opts = {}) {
  if (document.getElementById("brainguard-toast")) return;
  const wrap = document.createElement("div");
  wrap.id = "brainguard-toast";
  wrap.className = "bg-toast" + (opts.over ? " bg-over" : "");
  wrap.innerHTML = `
    <div class="bg-hd">
      <span class="bg-dot"></span> BrainGuard
      <button class="bg-x" aria-label="Close">×</button>
    </div>
    <div class="bg-msg"></div>
    <div class="bg-meta"></div>
  `;
  wrap.querySelector(".bg-msg").textContent = message;
  if (opts.meta) wrap.querySelector(".bg-meta").textContent = opts.meta;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add("bg-in"));
  const close = () => {
    wrap.classList.remove("bg-in");
    setTimeout(() => wrap.remove(), 350);
  };
  wrap.querySelector(".bg-x").addEventListener("click", close);
  setTimeout(close, opts.over ? 9000 : 7000);
}

function showOverlay(message, meta) {
  if (document.getElementById("brainguard-overlay")) return;
  const o = document.createElement("div");
  o.id = "brainguard-overlay";
  o.innerHTML = `
    <div class="bg-ov-card">
      <div class="bg-ov-tag">BrainGuard</div>
      <div class="bg-ov-msg"></div>
      <div class="bg-ov-meta"></div>
      <div class="bg-ov-actions">
        <button class="bg-ov-think">Take 30 seconds to think</button>
        <button class="bg-ov-skip">Continue anyway</button>
      </div>
    </div>
  `;
  o.querySelector(".bg-ov-msg").textContent = message;
  o.querySelector(".bg-ov-meta").textContent = meta || "";
  document.body.appendChild(o);
  let timer = null;
  const dismiss = () => { if (timer) clearInterval(timer); o.remove(); };
  o.querySelector(".bg-ov-skip").addEventListener("click", dismiss);
  const thinkBtn = o.querySelector(".bg-ov-think");
  thinkBtn.addEventListener("click", () => {
    let n = 30; thinkBtn.disabled = true;
    thinkBtn.textContent = `Thinking… ${n}s`;
    timer = setInterval(() => {
      n -= 1;
      if (n <= 0) { dismiss(); return; }
      thinkBtn.textContent = `Thinking… ${n}s`;
    }, 1000);
  });
}

/* ---------------- Proof of Thought brain games ---------------- */
const RIDDLES = [
  { q: "I speak without a mouth and hear without ears. What am I?", a: ["echo"] },
  { q: "What has keys but can't open locks?", a: ["piano", "keyboard"] },
  { q: "The more you take, the more you leave behind. What are they?", a: ["footsteps", "steps"] },
  { q: "What gets wetter the more it dries?", a: ["towel"] },
  { q: "I have cities but no houses, mountains but no trees. What am I?", a: ["map"] },
  { q: "What has hands but cannot clap?", a: ["clock"] },
  { q: "What invention lets you look right through a wall?", a: ["window"] },
  { q: "What can travel around the world while staying in a corner?", a: ["stamp"] },
  { q: "What has a head, a tail, but no body?", a: ["coin"] },
  { q: "The more of me you take, the bigger I get. What am I?", a: ["hole"] },
];

const UNSCRAMBLE_WORDS = [
  "curiosity","library","mountain","journey","silence","gravity","whisper","horizon",
  "thunder","crystal","puzzle","balance","kindness","forest","compass","planet",
  "lantern","pattern","oxygen","wisdom","harvest","velvet","quartz","rhythm",
];
const ODD_ONE_OUT = [
  { items: ["apple","pear","carrot","banana"], a: ["carrot"] },
  { items: ["square","triangle","circle","cube"], a: ["cube"] },
  { items: ["mercury","venus","mars","moon"], a: ["moon"] },
  { items: ["violin","guitar","flute","cello"], a: ["flute"] },
  { items: ["whale","shark","dolphin","tuna"], a: ["tuna"] },
  { items: ["copper","silver","gold","oxygen"], a: ["oxygen"] },
  { items: ["sparrow","eagle","bat","robin"], a: ["bat"] },
  { items: ["hammer","wrench","screwdriver","banana"], a: ["banana"] },
];
const SEQUENCES = [
  { q: "Next in the pattern: 2, 4, 8, 16, ?", a: ["32"] },
  { q: "Next in the pattern: 1, 1, 2, 3, 5, 8, ?", a: ["13"] },
  { q: "Next in the pattern: 3, 6, 12, 24, ?", a: ["48"] },
  { q: "Next in the pattern: 1, 4, 9, 16, ?", a: ["25"] },
  { q: "Next in the pattern: 100, 81, 64, 49, ?", a: ["36"] },
  { q: "Next in the pattern: 2, 3, 5, 7, 11, ?", a: ["13"] },
  { q: "Next in the pattern: 5, 10, 20, 35, 55, ?", a: ["80"] },
  { q: "Next letter: A, C, E, G, ?", a: ["i"] },
  { q: "Next letter: Z, Y, X, W, ?", a: ["v"] },
  { q: "Next in the pattern: 1, 2, 4, 7, 11, 16, ?", a: ["22"] },
];
const REVERSE_WORDS = ["focus","attention","memory","insight","clarity","reason","instinct"];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const recentPuzzleKeys = [];
function rememberPuzzle(key) {
  recentPuzzleKeys.push(key);
  if (recentPuzzleKeys.length > 8) recentPuzzleKeys.shift();
}
function isRecent(key) { return recentPuzzleKeys.includes(key); }

/* Each builder returns { q, hint, a?, render?(host, done) } */
const BUILDERS = {
  unscramble() {
    let word; for (let i = 0; i < 6; i++) { word = pick(UNSCRAMBLE_WORDS); if (!isRecent("u:"+word)) break; }
    rememberPuzzle("u:"+word);
    const scrambled = shuffle(word.split("")).join(" ").toUpperCase();
    return { q: `Unscramble this word: ${scrambled}`, hint: "Type the word", a: [word] };
  },
  oddoneout() {
    let item; for (let i = 0; i < 6; i++) { item = pick(ODD_ONE_OUT); if (!isRecent("o:"+item.items.join())) break; }
    rememberPuzzle("o:"+item.items.join());
    return { q: `Which one doesn't belong?  ${item.items.map(x=>x).join(" · ")}`, hint: "Type the odd word", a: item.a };
  },
  sequence() {
    let s; for (let i = 0; i < 6; i++) { s = pick(SEQUENCES); if (!isRecent("s:"+s.q)) break; }
    rememberPuzzle("s:"+s.q);
    return { ...s, hint: "Type the next item" };
  },
  reverse() {
    let w; for (let i = 0; i < 6; i++) { w = pick(REVERSE_WORDS); if (!isRecent("r:"+w)) break; }
    rememberPuzzle("r:"+w);
    return { q: `Type this word backwards: ${w.toUpperCase()}`, hint: "Spell it in reverse", a: [w.split("").reverse().join("")] };
  },
  memory() {
    const len = 6 + Math.floor(Math.random() * 2); // 6-7 digits
    const digits = Array.from({length: len}, () => Math.floor(Math.random() * 10)).join("");
    return {
      q: "Memory check: remember the digits, then type them.",
      hint: "Digits hide after a few seconds",
      render(host, done) {
        host.innerHTML = `
          <div class="bg-game-show">${digits}</div>
          <div class="bg-game-meta">Memorize · hides in <b>4</b>s</div>
          <input class="bg-puzzle-input bg-game-input" type="text" inputmode="numeric" autocomplete="off" placeholder="Type the digits" disabled />
          <div class="bg-puzzle-err"></div>
        `;
        const show = host.querySelector(".bg-game-show");
        const meta = host.querySelector(".bg-game-meta b");
        const input = host.querySelector(".bg-game-input");
        const err = host.querySelector(".bg-puzzle-err");
        let n = 4;
        const t = setInterval(() => {
          n -= 1; if (meta) meta.textContent = n;
          if (n <= 0) {
            clearInterval(t);
            show.textContent = "•".repeat(digits.length);
            show.classList.add("bg-hidden");
            host.querySelector(".bg-game-meta").textContent = "Now type what you saw.";
            input.disabled = false; input.focus();
          }
        }, 1000);
        const submit = () => {
          if (input.disabled) return;
          if (input.value.trim() === digits) done(true);
          else { err.textContent = "Not quite. Try a new puzzle."; input.select(); }
        };
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
        host._submit = submit;
      }
    };
  },
  stroop() {
    const COLORS = [
      { name: "red", hex: "#ef4444" },
      { name: "blue", hex: "#3b82f6" },
      { name: "green", hex: "#22c55e" },
      { name: "yellow", hex: "#eab308" },
      { name: "purple", hex: "#a855f7" },
    ];
    const word = pick(COLORS);
    let ink; do { ink = pick(COLORS); } while (ink.name === word.name);
    const choices = shuffle(COLORS).slice(0, 4);
    if (!choices.find(c => c.name === ink.name)) choices[0] = ink;
    return {
      q: "Tap the INK COLOR (not the word).",
      hint: "Ignore what it says — pick the color it's drawn in",
      render(host, done) {
        host.innerHTML = `
          <div class="bg-game-stroop">${word.name.toUpperCase()}</div>
          <div class="bg-game-choices"></div>
          <div class="bg-puzzle-err"></div>
        `;
        host.querySelector(".bg-game-stroop").style.color = ink.hex;
        const wrap = host.querySelector(".bg-game-choices");
        const err = host.querySelector(".bg-puzzle-err");
        choices.forEach(c => {
          const b = document.createElement("button");
          b.className = "bg-game-chip";
          b.textContent = c.name;
          b.addEventListener("click", () => {
            if (c.name === ink.name) done(true);
            else { err.textContent = "Wrong color — look at the ink, not the word."; }
          });
          wrap.appendChild(b);
        });
      }
    };
  },
  math() {
    let q, ans, key, tries = 0;
    do {
      const a = 2 + Math.floor(Math.random() * 12);
      const b = 2 + Math.floor(Math.random() * 12);
      const c = 2 + Math.floor(Math.random() * 9);
      const variant = Math.floor(Math.random() * 4);
      if (variant === 0) { q = `What is (${a} × ${b}) − ${c}?`; ans = a*b - c; }
      else if (variant === 1) { q = `What is ${a*b} ÷ ${a}?`; ans = b; }
      else if (variant === 2) { q = `What is ${a*a} − ${b}?`; ans = a*a - b; }
      else { q = `What is ${a} × ${b+c}?`; ans = a*(b+c); }
      key = "m:"+q;
      tries++;
    } while (isRecent(key) && tries < 8);
    rememberPuzzle(key);
    return { q, hint: "Type the number", a: [String(ans)] };
  },
  riddle() {
    let r; for (let i = 0; i < 6; i++) { r = pick(RIDDLES); if (!isRecent("rd:"+r.q)) break; }
    rememberPuzzle("rd:"+r.q);
    return { ...r, hint: "Type one word" };
  },
};

// Weighted picker — reduce riddles & math, favor varied brain games.
const PUZZLE_WEIGHTS = [
  ["unscramble", 22],
  ["oddoneout", 18],
  ["sequence",  18],
  ["reverse",   12],
  ["memory",    12],
  ["stroop",    10],
  ["math",       5],
  ["riddle",     3],
];
function pickPuzzleType() {
  const total = PUZZLE_WEIGHTS.reduce((s, [,w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of PUZZLE_WEIGHTS) { if ((r -= w) <= 0) return k; }
  return "unscramble";
}
function makePuzzle() { return BUILDERS[pickPuzzleType()](); }

function showPuzzleOverlay(meta) {
  if (document.getElementById("brainguard-overlay")) return;
  const o = document.createElement("div");
  o.id = "brainguard-overlay";
  o.innerHTML = `
    <div class="bg-ov-card">
      <div class="bg-ov-tag">BrainGuard · Proof of Thought</div>
      <div class="bg-ov-msg">You're past your daily AI limit. Warm up your brain first.</div>
      <div class="bg-ov-meta"></div>
      <div class="bg-puzzle">
        <div class="bg-puzzle-q"></div>
        <div class="bg-puzzle-host"></div>
      </div>
      <div class="bg-ov-actions">
        <button class="bg-ov-think">Submit</button>
        <button class="bg-ov-skip">New game</button>
      </div>
    </div>
  `;
  o.querySelector(".bg-ov-meta").textContent = meta || "";
  document.body.appendChild(o);

  const qEl = o.querySelector(".bg-puzzle-q");
  const host = o.querySelector(".bg-puzzle-host");
  const submitBtn = o.querySelector(".bg-ov-think");
  const skipBtn = o.querySelector(".bg-ov-skip");

  let current = null;

  function done(ok) {
    if (ok) {
      bgState.puzzlePassedUntil = Date.now() + 2 * 60 * 1000; // 2-min grace after solving
      o.remove();
    }
  }

  function load() {
    current = makePuzzle();
    qEl.textContent = current.q;
    host.innerHTML = "";
    if (current.render) {
      submitBtn.style.display = current._needsSubmit === false ? "none" : "";
      current.render(host, done);
      // For custom renders that include their own input (memory), wire submit btn.
      submitBtn.onclick = () => { if (host._submit) host._submit(); };
      // Stroop has no submit button needed.
      if (host.querySelector(".bg-game-choices") && !host._submit) {
        submitBtn.style.display = "none";
      }
    } else {
      submitBtn.style.display = "";
      host.innerHTML = `
        <input class="bg-puzzle-input" type="text" autocomplete="off" placeholder="${current.hint || "Your answer"}" />
        <div class="bg-puzzle-err"></div>
      `;
      const input = host.querySelector(".bg-puzzle-input");
      const err = host.querySelector(".bg-puzzle-err");
      setTimeout(() => input.focus(), 50);
      const submit = () => {
        const v = input.value.trim().toLowerCase();
        if (!v) return;
        if (current.a.some(x => String(x).toLowerCase() === v)) done(true);
        else { err.textContent = "Not quite. Try again, or load a new game."; input.select(); }
      };
      submitBtn.onclick = submit;
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    }
  }

  skipBtn.addEventListener("click", load);
  load();
}

/* ---------------- Pre-prompt proactive nudge ---------------- */
const PREPROMPT_COOLDOWN_MS = 5 * 60 * 1000; // once per 5 min per page
let lastPrepromptAt = 0;

function showPrepromptNudge() {
  const now = Date.now();
  if (now - lastPrepromptAt < PREPROMPT_COOLDOWN_MS) return;
  // Don't pile on top of other gates/overlays.
  if (document.getElementById("brainguard-overlay")) return;
  if (document.getElementById("brainguard-intent")) return;
  if (document.getElementById("brainguard-toast")) return;
  lastPrepromptAt = now;
  const line = NUDGES_PREPROMPT[Math.floor(Math.random() * NUDGES_PREPROMPT.length)];
  showToast(line, { meta: "Before you ask the AI…" });
}

function isAiInput(t) {
  if (!t) return false;
  const tag = (t.tagName || "").toLowerCase();
  return t.isContentEditable || tag === "textarea" || (tag === "input" && t.type === "text");
}

document.addEventListener("focusin", (e) => {
  if (isAiInput(e.target)) showPrepromptNudge();
}, true);

const bgState = { overGoal: false, ghostWriter: false, proofOfThought: true, unlockedUntil: 0, aiMin: 0, goal: 30, puzzlePassedUntil: 0 };

function bgLog(...args) { try { console.log("[BrainGuard]", ...args); } catch {} }

function showIntentGate(onUnlock) {
  if (document.getElementById("brainguard-intent")) return;
  const o = document.createElement("div");
  o.id = "brainguard-intent";
  o.innerHTML = `
    <div class="bg-ov-card">
      <div class="bg-ov-tag">BrainGuard · Ghost Writer</div>
      <div class="bg-ov-msg">Type a 10-word intent statement to unlock the AI.</div>
      <div class="bg-ov-meta">e.g. "I am using this to brainstorm, not to cheat today."</div>
      <textarea class="bg-intent-input" rows="3" placeholder="Write at least 10 words…"></textarea>
      <div class="bg-intent-meta">0 / 10 words</div>
      <div class="bg-ov-actions">
        <button class="bg-ov-think" disabled>Unlock for 60s</button>
        <button class="bg-ov-skip">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(o);
  const ta = o.querySelector(".bg-intent-input");
  const meta = o.querySelector(".bg-intent-meta");
  const btn = o.querySelector(".bg-ov-think");
  setTimeout(() => ta.focus(), 50);
  ta.addEventListener("input", () => {
    const n = ta.value.trim().split(/\s+/).filter(Boolean).length;
    meta.textContent = `${n} / 10 words`;
    btn.disabled = n < 10;
  });
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    o.remove();
    onUnlock?.();
  });
  o.querySelector(".bg-ov-skip").addEventListener("click", () => o.remove());
}

function ghostBlur() {
  if (document.getElementById("brainguard-blur-badge")) return;
  const target = document.querySelector("main") || document.body;
  target.classList.add("bg-blurred");
  const badge = document.createElement("div");
  badge.id = "brainguard-blur-badge";
  badge.innerHTML = `<span class="bg-dot"></span> Ghost Writer · <b>5</b>s`;
  document.body.appendChild(badge);
  let n = 5;
  const t = setInterval(() => {
    n -= 1;
    const b = badge.querySelector("b"); if (b) b.textContent = n;
    if (n <= 0) { clearInterval(t); target.classList.remove("bg-blurred"); badge.remove(); }
  }, 1000);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "BRAINGUARD_NUDGE") return;
  bgState.overGoal = !!msg.overGoal;
  bgState.ghostWriter = !!msg.ghostWriter;
  bgState.proofOfThought = !!msg.proofOfThought;
  bgState.aiMin = msg.aiMinutes || 0;
  bgState.goal = msg.goalMinutes || bgState.goal;
  bgLog("nudge", { overGoal: bgState.overGoal, aiMin: bgState.aiMin, goal: bgState.goal, pot: bgState.proofOfThought });
  const line = pickNudge(msg.intensity, msg.customNudges, msg.onlyCustom);
  const meta = `${msg.aiMinutes} min on AI today · goal ${msg.goalMinutes} min`;
  if (msg.overGoal && msg.proofOfThought) {
    showPuzzleOverlay(meta);
  } else if (msg.intensity === "strict" && msg.overGoal) {
    showOverlay(line, meta);
  } else {
    showToast(line, { meta, over: msg.overGoal });
  }
});

/* ---------------- Prompt categorization ---------------- */
// Heuristic classifier — labels every prompt as one of:
// direct-answer | explanation | reflective | brainstorm | refinement
function classifyPrompt(raw) {
  const text = (raw || "").trim().toLowerCase();
  if (!text) return "direct-answer";

  // --- Refinement: editing / transforming existing content ---
  // Strong verbs that almost always imply editing existing text/code.
  const strongRefine = /\b(rewrite|reword|rephrase|paraphrase|proofread|reformat|restructure|refactor|polish|tighten|condense|summari[sz]e|tl;?dr|translate|humanize|bulletize|simplify|expand on this|elaborate on this)\b/;
  // Weaker verbs (improve/fix/edit/shorten/...) only count as refinement when
  // paired with an object indicator like "this", "the following", "my essay",
  // pasted code, etc. Otherwise "how can I improve my sleep" would misclassify.
  const weakRefine = /\b(edit|revise|fix|correct|improve|enhance|clean up|tidy up|shorten|lengthen|expand|trim|tone (down|up)|format|convert|turn) (this|it|that|the (following|above|below|text|paragraph|email|essay|code|snippet|draft|message)|my (text|paragraph|email|essay|code|snippet|draft|message|writing|paper|cover letter|resume|cv|bio|post|caption))\b/;
  const refineShape = /\b(make (it|this|the \w+) (shorter|longer|concise|more concise|clearer|clear|better|stronger|formal|casual|professional|friendly|polite|punchier|simpler))\b/;
  const grammar = /\b(grammar (check|fix)|spell ?check|check (the )?grammar|fix (the )?grammar|fix typos)\b/;
  const styleAs = /\b(rewrite (it|this) (as|in)|in the style of|format (it|this) as|convert (it|this) (to|into))\b/;
  if (strongRefine.test(text) || weakRefine.test(text) || refineShape.test(text) || grammar.test(text) || styleAs.test(text)) {
    return "refinement";
  }

  // --- Reflective: opinions, decisions, feelings, advice (checked before
  // brainstorm so "do you think this is a good idea" isn't caught by "idea") ---
  if (/\b(should i|do you think|what do you think|help me decide|need advice|any advice|i('?m| am) (stuck|struggling|unsure|confused|torn|trying|feeling)|i feel|am i (right|wrong|being|overthinking)|is it (okay|ok|fine|wrong|right|normal)|what would you (do|recommend|suggest)|am i overthinking)\b/.test(text)) {
    return "reflective";
  }

  // --- Brainstorm: ideation, lists, options ---
  if (/\b(brainstorm|ideas?|suggest|suggestions?|alternatives?|options?|name (some|a few)|list( me| out)?|give me \d*\s*(ideas|examples|ways|options|tips)|examples of|come up with|possibilities|ways to)\b/.test(text)) {
    return "brainstorm";
  }

  // --- Explanation: open-ended understanding ---
  if (/^(why|how does|how do|how can|how would|how is|explain|describe|what is|what are|what does|what's the difference|whats the difference|tell me about|help me understand|walk me through|break (this |it )?down|elaborate on)\b/.test(text)) {
    return "explanation";
  }

  // Default: short factual / direct lookup
  return "direct-answer";
}

let lastEditableText = "";
document.addEventListener("input", (e) => {
  const t = e.target;
  if (!t) return;
  if (t.isContentEditable) lastEditableText = (t.innerText || t.textContent || "").trim();
  else if (typeof t.value === "string") lastEditableText = t.value.trim();
}, true);

function getCurrentPromptText(target) {
  if (target) {
    if (target.isContentEditable) return (target.innerText || target.textContent || "").trim();
    if (typeof target.value === "string") return target.value.trim();
  }
  // Fallback: nearest editable on the page
  const ed = document.querySelector('textarea, [contenteditable="true"]');
  if (ed) {
    if (ed.isContentEditable) return (ed.innerText || ed.textContent || "").trim();
    if (typeof ed.value === "string") return ed.value.trim();
  }
  return lastEditableText;
}

let lastNotifyAt = 0;
function notifyPrompt(text) {
  const now = Date.now();
  if (now - lastNotifyAt < 1500) return; // dedupe Enter + programmatic click
  lastNotifyAt = now;
  const category = classifyPrompt(text);
  try { chrome.runtime.sendMessage({ type: "BRAINGUARD_PROMPT_SENT", category, length: (text || "").length }); } catch {}
  if (bgState.overGoal && bgState.ghostWriter && Date.now() < bgState.unlockedUntil) {
    ghostBlur();
  }
}

function potGateIfNeeded(e) {
  if (!bgState.overGoal || !bgState.proofOfThought) return false;
  if (Date.now() < bgState.puzzlePassedUntil) return false;
  if (document.getElementById("brainguard-overlay")) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    return true;
  }
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  const meta = `${bgState.aiMin} min on AI today · goal ${bgState.goal} min`;
  showPuzzleOverlay(meta);
  return true;
}

function gateIfNeeded(e) {
  if (potGateIfNeeded(e)) return true;
  if (!bgState.overGoal || !bgState.ghostWriter) return false;
  if (Date.now() < bgState.unlockedUntil) return false;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  showIntentGate(() => {
    bgState.unlockedUntil = Date.now() + 60_000;
    const t = e.target;
    if (t && typeof t.focus === "function") t.focus();
  });
  return true;
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey) return;
  const t = e.target;
  if (!t) return;
  const tag = (t.tagName || "").toLowerCase();
  const editable = t.isContentEditable || tag === "textarea" || (tag === "input" && t.type === "text");
  if (!editable) return;
  if (gateIfNeeded(e)) return;
  notifyPrompt(getCurrentPromptText(t));
}, true);

document.addEventListener("click", (e) => {
  const el = e.target?.closest?.("button,[role=button]");
  if (!el) return;
  const label = (el.getAttribute("aria-label") || el.textContent || "").toLowerCase();
  if (/send|submit|ask|generate/.test(label) || el.querySelector('svg[data-icon="send"]')) {
    if (gateIfNeeded(e)) return;
    notifyPrompt(getCurrentPromptText(null));
  }
}, true);


function refreshBgState(showIfOver) {
  try {
    chrome.runtime.sendMessage({ type: "BRAINGUARD_GET_STATE" }, (res) => {
      if (!res) return;
      const aiMin = (res.day?.aiSec || 0) / 60;
      const goal = res.settings?.aiGoalMinutes || 30;
      bgState.aiMin = Math.round(aiMin);
      bgState.goal = goal;
      bgState.overGoal = aiMin > goal;
      bgState.ghostWriter = !!res.settings?.ghostWriter;
      bgState.proofOfThought = !!res.settings?.proofOfThought;
      bgLog("state", { aiMin: bgState.aiMin, goal, overGoal: bgState.overGoal, pot: bgState.proofOfThought });
      if (showIfOver && bgState.overGoal && bgState.proofOfThought
          && Date.now() >= bgState.puzzlePassedUntil
          && !document.getElementById("brainguard-overlay")) {
        const meta = `${bgState.aiMin} min on AI today · goal ${goal} min`;
        showPuzzleOverlay(meta);
      }
    });
  } catch {}
}

refreshBgState(true);
setInterval(() => refreshBgState(true), 30_000);

// Manual trigger to verify the puzzle works: Ctrl+Shift+B
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === "B" || e.key === "b")) {
    e.preventDefault();
    bgLog("manual puzzle trigger");
    const meta = `${bgState.aiMin} min on AI today · goal ${bgState.goal} min`;
    showPuzzleOverlay(meta);
  }
}, true);

/* ---------------- Floating draggable mini-panel ---------------- */
(function initBrainguardPanel() {
  if (window.top !== window) return; // only on top frame
  if (document.getElementById("brainguard-panel")) return;

  const SESSION_HIDE_KEY = "__bg_panel_hidden_session";
  if (sessionStorage.getItem(SESSION_HIDE_KEY) === "1") return;

  function build() {
    const p = document.createElement("div");
    p.id = "brainguard-panel";
    p.innerHTML = `
      <div class="bg-pn-hd">
        <span class="bg-pn-dot"></span> BrainGuard
        <div class="bg-pn-actions">
          <button class="bg-pn-btn bg-pn-min" title="Minimize">–</button>
          <button class="bg-pn-btn bg-pn-x" title="Hide for this tab">×</button>
        </div>
      </div>
      <div class="bg-pn-body">
        <div class="bg-pn-row"><span>AI today</span><b class="bg-pn-ai">– min</b></div>
        <div class="bg-pn-row"><span>Prompts</span><b class="bg-pn-pr">0</b></div>
        <div class="bg-pn-row"><span>Goal</span><b class="bg-pn-goal">– min</b></div>
        <div class="bg-pn-bar"><span style="width:0%"></span></div>
        <div class="bg-pn-section">Prompt breakdown</div>
        <div class="bg-pn-cats">
          <div class="bg-pn-cat" data-k="direct-answer"><span>Direct-answer</span><b>0</b></div>
          <div class="bg-pn-cat" data-k="explanation"><span>Explanation</span><b>0</b></div>
          <div class="bg-pn-cat" data-k="reflective"><span>Reflective</span><b>0</b></div>
          <div class="bg-pn-cat" data-k="brainstorm"><span>Brainstorm</span><b>0</b></div>
          <div class="bg-pn-cat" data-k="refinement"><span>Refinement</span><b>0</b></div>
        </div>
        <div class="bg-pn-meta">Drag the header to move · click × to hide</div>
      </div>
    `;
    document.body.appendChild(p);
    return p;
  }

  function applySavedPos(p) {
    try {
      chrome.storage.local.get("panelPos", ({ panelPos }) => {
        if (!panelPos) return;
        const { left, top } = panelPos;
        if (typeof left === "number" && typeof top === "number") {
          p.style.left = Math.max(0, Math.min(window.innerWidth - 60, left)) + "px";
          p.style.top = Math.max(0, Math.min(window.innerHeight - 40, top)) + "px";
          p.style.right = "auto";
        }
        if (panelPos.minimized) p.classList.add("bg-min");
      });
    } catch {}
  }

  function makeDraggable(p) {
    const hd = p.querySelector(".bg-pn-hd");
    let dx = 0, dy = 0, startL = 0, startT = 0, dragging = false;
    hd.addEventListener("mousedown", (e) => {
      if (e.target.closest(".bg-pn-btn")) return;
      dragging = true;
      p.classList.add("bg-dragging");
      const rect = p.getBoundingClientRect();
      startL = rect.left; startT = rect.top;
      dx = e.clientX; dy = e.clientY;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const left = Math.max(0, Math.min(window.innerWidth - 60, startL + (e.clientX - dx)));
      const top  = Math.max(0, Math.min(window.innerHeight - 40, startT + (e.clientY - dy)));
      p.style.left = left + "px";
      p.style.top = top + "px";
      p.style.right = "auto";
    });
    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      p.classList.remove("bg-dragging");
      const rect = p.getBoundingClientRect();
      try {
        chrome.storage.local.get("panelPos", ({ panelPos }) => {
          chrome.storage.local.set({ panelPos: { ...(panelPos || {}), left: rect.left, top: rect.top } });
        });
      } catch {}
    });
  }

  function refresh(p) {
    try {
      chrome.runtime.sendMessage({ type: "BRAINGUARD_GET_STATE" }, (res) => {
        if (!res) return;
        const aiMin = Math.round((res.day?.aiSec || 0) / 60);
        const prompts = res.day?.aiPrompts || 0;
        const goal = res.settings?.aiGoalMinutes || 30;
        p.querySelector(".bg-pn-ai").textContent = `${aiMin} min`;
        p.querySelector(".bg-pn-pr").textContent = prompts;
        p.querySelector(".bg-pn-goal").textContent = `${goal} min`;
        const pct = Math.max(0, Math.min(100, (aiMin / goal) * 100));
        p.querySelector(".bg-pn-bar > span").style.width = pct + "%";
        const cats = res.day?.promptCategories || {};
        p.querySelectorAll(".bg-pn-cat").forEach(el => {
          const k = el.dataset.k;
          el.querySelector("b").textContent = cats[k] || 0;
        });
      });
    } catch {}
  }

  const p = build();
  applySavedPos(p);
  makeDraggable(p);
  refresh(p);
  const t = setInterval(() => refresh(p), 5000);

  p.querySelector(".bg-pn-x").addEventListener("click", () => {
    sessionStorage.setItem(SESSION_HIDE_KEY, "1");
    clearInterval(t);
    p.remove();
  });
  p.querySelector(".bg-pn-min").addEventListener("click", () => {
    p.classList.toggle("bg-min");
    const minimized = p.classList.contains("bg-min");
    try {
      chrome.storage.local.get("panelPos", ({ panelPos }) => {
        chrome.storage.local.set({ panelPos: { ...(panelPos || {}), minimized } });
      });
    } catch {}
  });
})();
