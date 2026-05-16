// Plays a soft two-tone chime via Web Audio when the background asks.
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (self.AudioContext || self.webkitAudioContext)();
  return ctx;
}

function playTone(freq, startOffset, duration, gainPeak) {
  const ac = getCtx();
  const t0 = ac.currentTime + startOffset;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function playChime(variant) {
  // variant: "work" (rising) or "break" (falling). Soft, short, gentle.
  try {
    if (variant === "work") {
      playTone(660, 0,    0.45, 0.18);
      playTone(880, 0.18, 0.55, 0.22);
    } else {
      playTone(880, 0,    0.45, 0.18);
      playTone(660, 0.18, 0.55, 0.22);
    }
  } catch (e) { /* ignore */ }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "BRAINGUARD_PLAY_CHIME") {
    playChime(msg.variant || "break");
  }
});
