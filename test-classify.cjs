// BrainGuard prompt categorization test suite
// Run with: node extension/test-classify.js
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "content.js"), "utf8");
const start = src.indexOf("function classifyPrompt");
const end = src.indexOf("\nlet lastEditableText");
const fn = src.slice(start, end);
eval(fn);

const cases = [
  // refinement
  ["rewrite this email to sound more formal", "refinement"],
  ["paraphrase the following paragraph", "refinement"],
  ["proofread my cover letter", "refinement"],
  ["polish this paragraph", "refinement"],
  ["make it shorter", "refinement"],
  ["make this more concise", "refinement"],
  ["fix the grammar in my essay", "refinement"],
  ["grammar check the following text", "refinement"],
  ["translate this to spanish", "refinement"],
  ["summarize this article", "refinement"],
  ["tldr the following", "refinement"],
  ["refactor my code below", "refinement"],
  ["humanize this ai text", "refinement"],
  ["improve my resume", "refinement"],
  ["clean up this draft", "refinement"],
  ["convert this to markdown", "refinement"],
  ["rewrite it in the style of hemingway", "refinement"],
  ["shorten my bio", "refinement"],
  ["expand on this", "refinement"],
  ["fix typos", "refinement"],

  // brainstorm
  ["brainstorm names for a dog", "brainstorm"],
  ["give me 5 ideas for a startup", "brainstorm"],
  ["list me some sci-fi books", "brainstorm"],
  ["suggest alternatives to react", "brainstorm"],
  ["ways to save money", "brainstorm"],

  // reflective
  ["should i quit my job?", "reflective"],
  ["do you think this is a good idea", "reflective"],
  ["i'm stuck on a decision", "reflective"],
  ["what would you do in my place", "reflective"],
  ["am i overthinking this", "reflective"],

  // explanation
  ["why is the sky blue", "explanation"],
  ["how does a transformer work", "explanation"],
  ["explain quantum entanglement", "explanation"],
  ["what is mitochondria", "explanation"],
  ["walk me through merge sort", "explanation"],
  ["how can I improve my sleep", "explanation"], // tricky: "improve" w/o object

  // direct-answer
  ["capital of france", "direct-answer"],
  ["weather tomorrow in paris", "direct-answer"],
  ["npm install command", "direct-answer"],
];

let pass = 0, fail = 0;
for (const [t, want] of cases) {
  const got = classifyPrompt(t);
  if (got === want) { pass++; }
  else { fail++; console.log(`FAIL: "${t}" -> ${got} (want ${want})`); }
}
console.log(`\n${pass}/${pass+fail} passed`);
process.exit(fail ? 1 : 0);
