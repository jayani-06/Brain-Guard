// BrainGuard AI URL detection test suite
// Run with: node extension/test-ai-urls.js

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

function isAiUrl(url, hosts, paths) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (hosts.includes(u.hostname)) return true;
    return paths.some(h => u.hostname === h.host && u.pathname.startsWith(h.path));
  } catch { return false; }
}

const tests = [
  // ChatGPT
  { url: "https://chatgpt.com", expected: true, label: "ChatGPT root" },
  { url: "https://chatgpt.com/c/abc123", expected: true, label: "ChatGPT conversation" },
  { url: "https://chatgpt.com/?model=gpt-4", expected: true, label: "ChatGPT with query" },
  { url: "https://www.chatgpt.com", expected: false, label: "ChatGPT www (not in list)" },

  // Claude
  { url: "https://claude.ai", expected: true, label: "Claude root" },
  { url: "https://claude.ai/chat/abc-123", expected: true, label: "Claude chat" },
  { url: "https://claude.ai/settings", expected: true, label: "Claude settings" },

  // Gemini
  { url: "https://gemini.google.com", expected: true, label: "Gemini root" },
  { url: "https://gemini.google.com/app", expected: true, label: "Gemini app" },
  { url: "https://gemini.google.com/share/xyz", expected: true, label: "Gemini share" },

  // Copilot
  { url: "https://copilot.microsoft.com", expected: true, label: "Copilot root" },
  { url: "https://copilot.microsoft.com/chats", expected: true, label: "Copilot chats" },

  // Perplexity
  { url: "https://perplexity.ai", expected: true, label: "Perplexity root" },
  { url: "https://www.perplexity.ai/search/abc", expected: true, label: "Perplexity search" },

  // Grok
  { url: "https://grok.com", expected: true, label: "Grok root" },
  { url: "https://grok.com/chat/123", expected: true, label: "Grok chat" },

  // DeepSeek
  { url: "https://chat.deepseek.com", expected: true, label: "DeepSeek root" },

  // Mistral
  { url: "https://chat.mistral.ai", expected: true, label: "Mistral root" },

  // HuggingFace (host match)
  { url: "https://huggingface.co", expected: true, label: "HF root (host match)" },
  { url: "https://huggingface.co/chat", expected: true, label: "HF chat (host+path match)" },
  { url: "https://huggingface.co/chat/conversation/123", expected: true, label: "HF chat deep (host+path match)" },

  // Poe
  { url: "https://poe.com", expected: true, label: "Poe root" },
  { url: "https://poe.com/ChatGPT", expected: true, label: "Poe bot" },

  // Character.ai
  { url: "https://character.ai", expected: true, label: "Character.ai root" },

  // You.com
  { url: "https://you.com", expected: true, label: "You.com root" },

  // Path-based: Bing Chat
  { url: "https://www.bing.com/chat?q=hello", expected: true, label: "Bing Chat" },
  { url: "https://www.bing.com/search?q=hello", expected: false, label: "Bing Search (not chat)" },
  { url: "https://bing.com/chat", expected: false, label: "Bing Chat no-www (not matched)" },

  // Path-based: X Grok
  { url: "https://x.com/i/grok", expected: true, label: "X Grok" },
  { url: "https://x.com/i/grok?text=hi", expected: true, label: "X Grok with query" },
  { url: "https://x.com/home", expected: false, label: "X home (not grok)" },
  { url: "https://twitter.com/i/grok", expected: false, label: "Twitter Grok (wrong host)" },

  // Non-AI sites
  { url: "https://google.com", expected: false, label: "Google" },
  { url: "https://github.com/copilot", expected: false, label: "GitHub Copilot (not in list)" },
  { url: "https://youtube.com", expected: false, label: "YouTube" },
  { url: "https://reddit.com/r/ChatGPT", expected: false, label: "Reddit ChatGPT sub" },
  { url: "https://openai.com/blog", expected: false, label: "OpenAI blog (not chat.openai.com)" },
  { url: "https://anthropic.com", expected: false, label: "Anthropic marketing (not claude.ai)" },
];

let passed = 0;
let failed = 0;

console.log("\nBrainGuard AI URL Detection Tests\n" + "=".repeat(40) + "\n");

for (const t of tests) {
  const result = isAiUrl(t.url, DEFAULT_AI_HOSTS, DEFAULT_AI_PATH_HINTS);
  const ok = result === t.expected;
  const status = ok ? "PASS" : "FAIL";
  const color = ok ? "\x1b[32m" : "\x1b[31m";
  const reset = "\x1b[0m";
  console.log(`${color}${status}${reset}  ${t.label}`);
  console.log(`       ${t.url}`);
  if (!ok) {
    console.log(`       Expected: ${t.expected}, Got: ${result}`);
    failed++;
  } else {
    passed++;
  }
}

console.log("\n" + "=".repeat(40));
console.log(`Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);

if (failed > 0) {
  process.exit(1);
}
