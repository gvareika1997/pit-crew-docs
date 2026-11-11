// Generates the reference pages from a pit-crew checkout, so no list is typed by hand.
//
//   node scripts/gen-reference.mjs /path/to/pit-crew
//
// Reads the frontmatter of commands, skills and agents, hooks/hooks.json with each
// script's header comment, and CONTEXT.md. Writes src/content/docs/reference/*.mdx.
// The output is committed: the docs repo does not contain the plugin source.
//
// Two lists below are curated, because the source text is written for the model, not
// for a reader: SKILL_SUMMARY (one line per skill) and GLOSSARY (the terms a user
// meets, by group). The run fails when a skill has no summary, when a summary names a
// skill that is gone, or when a glossary term is no longer in CONTEXT.md.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repo = path.resolve(process.argv[2] ?? process.env.PIT_CREW_SRC ?? '../pit-crew');
const core = path.join(repo, 'plugins/pit-crew');
if (!fs.existsSync(path.join(core, '.claude-plugin/plugin.json'))) {
  console.error(`No pit-crew checkout at ${repo}. Pass its path as the first argument.`);
  process.exit(1);
}
const out = path.resolve('src/content/docs/reference');
fs.mkdirSync(out, { recursive: true });

const version = JSON.parse(fs.readFileSync(path.join(core, '.claude-plugin/plugin.json'), 'utf8')).version;
let sha = 'unknown';
try {
  sha = execFileSync('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {}
const stamp = `Generated from pit-crew \`${sha}\` (core ${version}) by \`scripts/gen-reference.mjs\`. Do not edit by hand.`;

/** Minimal frontmatter reader: `key: value`, quoted values, and folded/literal blocks. */
function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const data = {};
  if (!m) return data;
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    let [, key, value] = kv;
    if (/^[>|][+-]?$/.test(value)) {
      const parts = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) parts.push(lines[++i].trim());
      value = parts.join(' ');
    }
    value = value.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }
    data[key] = value;
  }
  return data;
}

/** Escape text for an MDX table cell. */
const cell = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/[{}]/g, (c) => `\\${c}`)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n+/g, ' ')
    .trim();
const code = (s) => '`' + String(s).replace(/`/g, "'") + '`';

function page(file, title, description, body, extra = '') {
  const fm = `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n${extra}---\n\n`;
  fs.writeFileSync(path.join(out, file), fm + body.trim() + `\n\n---\n\n<small>${stamp}</small>\n`);
  console.log('wrote', path.join('src/content/docs/reference', file));
}

// ---- Commands -------------------------------------------------------------
const order = ['plan', 'dev', 'test', 'deploy'];
const commands = fs
  .readdirSync(path.join(core, 'commands'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ name: f.replace(/\.md$/, ''), ...frontmatter(path.join(core, 'commands', f)) }))
  .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

// One paragraph per command, written for a reader. Each restates the command's own
// frontmatter description; the trigger phrases stay in the source.
const COMMAND_SUMMARY = {
  plan: 'Phase 1. Discusses the request at the business level first and stops at a gate for your approval. It creates the ticket in the tracker, or runs without one. Then it designs the high-level architecture and stops at a second gate. A bug first runs a read-only triage, which `--no-triage` skips. Once you approve the architecture, it chains into implementation and runs unattended to green PRs when the session can write. Otherwise it stops with a relaunch line.',
  dev: 'Phase 2. Implements the approved work, runs the affected tests, reviews by risk and checks the acceptance criteria. Then it continues into the test phase.',
  test: 'Phase 3. Runs the test scope the change earned, opens the PRs, verifies the relevant behavior in DEV, resolves actionable feedback, reports the results and cleans up.',
  deploy: 'Phase 4. Manual only, never chained from another phase. Merges the run\'s approved PRs one at a time and drives each service\'s production rollout to completion: busy check, freeze check, version confirmation, a canary loop that advances on clean observed signals, and rollback detection. With `--driver human` you merge and advance each step while it monitors and recommends.',
};
const unsummarisedCommands = commands.map((c) => c.name).filter((n) => !COMMAND_SUMMARY[n]);
if (unsummarisedCommands.length) {
  console.error(`COMMAND_SUMMARY has no entry for: ${unsummarisedCommands.join(', ')}`);
  process.exit(1);
}
// Pages that exist for a manual skill. A manual skill with no page is listed without a link.
const MANUAL_SKILL_PAGE = {
  setup: '[Setup and health check](../../getting-started/setup/)',
  brainstorm: '[Brainstorm](../../how-it-works/brainstorm/)',
};
const manualSkills = fs
  .readdirSync(path.join(core, 'skills'))
  .filter((d) => fs.existsSync(path.join(core, 'skills', d, 'SKILL.md')))
  .sort()
  .filter((d) => frontmatter(path.join(core, 'skills', d, 'SKILL.md'))['disable-model-invocation'] === 'true');

page(
  'commands.mdx',
  `Commands (${commands.length})`,
  'The phase commands of Pit Crew, with their arguments.',
  `The phases of a run. Each one is a slash command you type in Claude Code. Phase pages: [plan](../../how-it-works/plan/), [dev](../../how-it-works/dev/), [test](../../how-it-works/test/), [deploy](../../how-it-works/deploy/).

${commands
  .map(
    (c) => `## ${code('/pit-crew:' + c.name)}

${COMMAND_SUMMARY[c.name]}

**Arguments:** ${c['argument-hint'] ? code(c['argument-hint']) : 'none'}`,
  )
  .join('\n\n')}

## Skills you type like a command

${manualSkills.length} skills run only when you type them: ${manualSkills
    .map((d) => code('/pit-crew:' + d) + (MANUAL_SKILL_PAGE[d] ? ` (${MANUAL_SKILL_PAGE[d]})` : ''))
    .join(', ')}. They are listed in [Skills](../skills/).`,
);

// ---- Skills ---------------------------------------------------------------
const skillsDir = path.join(core, 'skills');
const skills = fs
  .readdirSync(skillsDir)
  .filter((d) => fs.existsSync(path.join(skillsDir, d, 'SKILL.md')))
  .sort()
  .map((d) => ({ dir: d, ...frontmatter(path.join(skillsDir, d, 'SKILL.md')) }));

// One line per skill, written for a reader. Each line restates the skill's own
// frontmatter description and adds nothing to it. Trigger phrases stay in the source.
const SKILL_SUMMARY = {
  adr: 'Writes an architecture decision record in `docs/decisions/`, with the repo\'s naming convention and template.',
  artifact: 'Publishes the run\'s shareable plan page right before the 1c gate, and adds the Evidence tab after the DEV verdict.',
  brainstorm: 'Takes an idea too big for one ticket to a decided initiative: a focus statement, research, alternatives, one chosen option, a shareable page and, after you approve it, one tracker project with a milestone per deliverable.',
  bro: 'Restates the last message in plain language, with no jargon.',
  'dev-verification': 'Verifies the acceptance criteria in an ephemeral environment, a shared environment, in-cluster or in a local run, and records one case per criterion with its own evidence.',
  diagram: 'Draws the one visual of a phase: the architecture diagram of the plan page, the lead visual of a PR body or the optional diagram of a brainstorm page. Plain text and mermaid only.',
  flow: 'Creates or updates a feature flow doc in `docs/flows/`: the end-to-end narrative of a feature across services.',
  jira: 'Looks up an existing Jira ticket, read-only. It never creates or edits a ticket.',
  linear: 'Creates, searches and updates issues in a Linear workspace.',
  pipeline: 'The rules every phase follows: state writes, gates, the worktree rule, compact handoffs, risk-based delegation and phase results.',
  'pr-comment-resolution': 'Classifies, answers and resolves pull request feedback from review bots and humans, then verifies approval against the current head.',
  pr: 'Writes the title and body of a pull request in four sections: Summary, Evidence, Merge danger and Links.',
  setup: 'First-time setup and health check: inventories what Pit Crew needs, proposes a cleanup with a backup and a restore, and guides the credentials and connectors of the roles that are on.',
  'skill-authoring': 'Writing rules for the texts an agent reads: a skill, an agent, a command, a hook, a `CLAUDE.md`, an `AGENTS.md` or a rules file.',
  'task-routing': 'Sizes the pipeline to the task by effort, time and tokens: inline or delegated, the Builder effort profile, the context budget and the rounds.',
  'tool-authoring': 'Design rules and test templates for an MCP tool.',
  triage: 'Investigates a bug with evidence and reports its root cause, read-only, without fixing it. Two depths: Full and Quick.',
};
const skillKey = (s) => s.name || s.dir;
const unsummarised = skills.map(skillKey).filter((k) => !SKILL_SUMMARY[k]);
const goneSkills = Object.keys(SKILL_SUMMARY).filter((k) => !skills.some((s) => skillKey(s) === k));
if (unsummarised.length || goneSkills.length) {
  if (unsummarised.length) console.error(`SKILL_SUMMARY has no line for: ${unsummarised.join(', ')}`);
  if (goneSkills.length) console.error(`SKILL_SUMMARY names skills that are gone: ${goneSkills.join(', ')}`);
  process.exit(1);
}
const isManual = (s) => s['disable-model-invocation'] === 'true';
const skillRow = (s) => `| ${code((isManual(s) ? '/' : '') + 'pit-crew:' + skillKey(s))} | ${cell(SKILL_SUMMARY[skillKey(s)])} |`;

page(
  'skills.mdx',
  `Skills (${skills.length})`,
  'Every skill the Pit Crew core ships, with what each one does.',
  `A skill is a set of instructions Claude Code loads for one kind of task. You rarely name one: the phase commands load the skills they need.

## Skills you type

These run only when you type them. The model never loads them on its own.

| Skill | What it does |
|---|---|
${skills.filter(isManual).map(skillRow).join('\n')}

## Skills that load on their own

These load when the work in front of the model matches them: inside a run, or when you ask for that task outside one.

| Skill | What it does |
|---|---|
${skills.filter((s) => !isManual(s)).map(skillRow).join('\n')}`,
);

// ---- Agents ---------------------------------------------------------------
const agentsDir = path.join(core, 'agents');
const agents = fs
  .readdirSync(agentsDir)
  .filter((f) => f.endsWith('.md'))
  .sort()
  .map((f) => frontmatter(path.join(agentsDir, f)));

page(
  'agents.mdx',
  `Agents (${agents.length})`,
  'The pipeline agents of Pit Crew: what each one does, its model and its tools.',
  `The phase commands dispatch these agents. You do not call them yourself. Each one has a fixed job, a model and a tool list, and a hook denies it any MCP tool outside the [roles](../../roles/) it holds.

| Agent | Job | Model | Effort |
|---|---|---|---|
${agents.map((a) => `| ${code(a.name)} | ${cell(a.description)} | ${cell(a.model || 'inherits')} | ${cell(a.effort || '')} |`).join('\n')}

## Tools each agent may use

| Agent | Tools |
|---|---|
${agents.map((a) => `| ${code(a.name)} | ${cell(a.tools || 'all')} |`).join('\n')}`,
);

// ---- Hooks ----------------------------------------------------------------
const hooksJson = JSON.parse(fs.readFileSync(path.join(core, 'hooks/hooks.json'), 'utf8'));
const registry = hooksJson.hooks ?? hooksJson;
function header(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const outLines = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (l.startsWith('#!') || l === "'use strict';" || l === '"use strict";') continue;
    const m = l.match(/^(?:#|\/\/|\*|\/\*+)\s?(.*?)(?:\*\/)?$/);
    if (m) outLines.push(m[1].trim());
    else if (l === '' && outLines.length === 0) continue;
    else break;
  }
  // First paragraph of the header only.
  const para = [];
  for (const l of outLines) {
    if (l === '' && para.length) break;
    if (l !== '') para.push(l);
  }
  return para.join(' ');
}
const rows = [];
for (const [event, entries] of Object.entries(registry)) {
  for (const e of entries) {
    for (const h of e.hooks ?? []) {
      const script = (h.command.match(/hooks\/([A-Za-z0-9_.-]+)/) ?? [])[1];
      if (!script) continue;
      const file = path.join(core, 'hooks', script);
      rows.push({ event, matcher: e.matcher ?? '', script, what: fs.existsSync(file) ? header(file) : '' });
    }
  }
}
page(
  'hooks.mdx',
  `Hooks (${new Set(rows.map((r) => r.script)).size})`,
  'The guards Pit Crew registers in Claude Code, and what each one blocks.',
  `Hooks are the part of Pit Crew that does not depend on the model following instructions. A guard runs before a tool call and denies it. What they protect, in plain terms: [Guardrails](../../how-it-works/guardrails/).

| Script | Event | Runs on | What its header says |
|---|---|---|---|
${rows.map((r) => `| ${code(r.script)} | ${cell(r.event)} | ${r.matcher ? code(r.matcher) : 'every call'} | ${cell(r.what)} |`).join('\n')}`,
);

// ---- Glossary -------------------------------------------------------------
// The terms a user meets in a run, by group. The definition of each one is read from
// CONTEXT.md, never typed here. A term is named by its English name.
const GLOSSARY = [
  ['Planning and gates', ['Assumption', 'Real question', 'Closed without asking', 'Slice', 'Mockup option']],
  ['Testing and evidence', ['Test spec', 'Case', 'Evidence', 'Carried evidence', 'Case designer', 'Configurator', 'Tester', 'Fixture manifest', 'Orphan fixture', 'Startup gate']],
  ['Review and pull requests', ['First judge review', 'Confirmation review', 'UI review', 'Universal check', 'Repo rule', 'Round', 'Automated reviewer', 'Unanswered bot finding', 'Minor finding', 'Merge-forward', 'PR own files', 'High-risk change', 'Success signal']],
  ['Deploy', ['Deploy driver', 'Safety stop']],
  ['How a run ends', ['Fix round', 'Clean run', 'Retried run', 'Retro', 'Away', 'Abandoned']],
  ['Bug triage', ['Triage', 'Triage mode', 'Root cause', 'Raw report', 'Not a bug', 'Business contract', 'Drift finding']],
  ['Product mode', ['Product mode', 'Big decision', 'Technical guide', 'Delivery to a technical person']],
  ['Brainstorm', ['Initiative', 'Deliverable', 'Focus statement', 'Wild idea']],
  ['Roles and packs', ['Role', 'Adapter', 'Binding', 'Pack']],
  ['Setup and access', ['First-time setup', 'Cleanup', 'Indispensable, recommended and optional tool tiers', 'Never configured', 'Rejected access', 'No response']],
];

/** Escape text for MDX prose, leaving `code spans` as they are. */
const prose = (s) =>
  s
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/[{}]/g, (c) => `\\${c}`).replace(/</g, '&lt;')))
    .join('');

// CONTEXT.md entries: "**Term** (es|en: "Other name"):" then the definition, then "_Avoid_: ...".
const context = fs.readFileSync(path.join(core, 'CONTEXT.md'), 'utf8');
const terms = new Map();
for (const block of context.split(/\n(?=\*\*[^*\n]+\*\*[^\n]*:\n)/)) {
  const head = block.match(/^\*\*([^*\n]+)\*\*\s*(?:\((es|en):\s*"?([^")]+)"?\))?:\n([\s\S]*)$/);
  if (!head) continue;
  const [, name, lang, other, rest] = head;
  const definition = rest
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('_Avoid_'))
    .join(' ')
    .trim();
  terms.set(lang === 'en' ? other.trim() : name.trim(), definition);
}
const missingTerms = GLOSSARY.flatMap(([, names]) => names).filter((n) => !terms.has(n));
if (missingTerms.length) {
  console.error(`GLOSSARY names terms that CONTEXT.md does not define: ${missingTerms.join(', ')}`);
  process.exit(1);
}
const shown = GLOSSARY.reduce((n, [, names]) => n + names.length, 0);
page(
  'glossary.mdx',
  'Glossary',
  'The words you meet in a Pit Crew run, one meaning per term.',
  `The words you meet in a run: at a gate, in a pull request, in the run report. Each one has one meaning. The definitions come from the plugin's own vocabulary file, \`CONTEXT.md\`, which defines ${terms.size} terms; this page shows the ${shown} a user sees.

${GLOSSARY.map(
  ([group, names]) => `## ${group}\n\n${names.map((n) => `### ${n}\n\n${prose(terms.get(n))}`).join('\n\n')}`,
).join('\n\n')}`,
  'tableOfContents:\n  maxHeadingLevel: 2\n',
);
