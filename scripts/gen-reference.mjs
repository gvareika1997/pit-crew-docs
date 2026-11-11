// Generates the reference pages from a pit-crew checkout, so no list is typed by hand.
//
//   node scripts/gen-reference.mjs /path/to/pit-crew
//
// Reads the frontmatter of commands, skills and agents, hooks/hooks.json with each
// script's header comment, and CONTEXT.md. Writes src/content/docs/reference/*.mdx.
// The output is committed: the docs repo does not contain the plugin source.
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

function page(file, title, description, body) {
  const fm = `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n\n`;
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

page(
  'commands.mdx',
  `Commands (${commands.length})`,
  'The phase commands of Pit Crew, with their arguments.',
  `The phases of a run. Each one is a slash command you type in Claude Code. Phase pages: [plan](../../how-it-works/plan/), [dev](../../how-it-works/dev/), [test](../../how-it-works/test/), [deploy](../../how-it-works/deploy/).

${commands
  .map(
    (c) => `## ${code('/pit-crew:' + c.name)}

${cell(c.description)}

**Arguments:** ${c['argument-hint'] ? code(c['argument-hint']) : 'none'}`,
  )
  .join('\n\n')}

## Manual-only skills you invoke like a command

Two skills run only when you type them: ${code('/pit-crew:setup')} ([Setup](../../getting-started/setup/)) and ${code('/pit-crew:brainstorm')} ([Brainstorm](../../how-it-works/brainstorm/)). They are listed in [Skills](../skills/).`,
);

// ---- Skills ---------------------------------------------------------------
const skillsDir = path.join(core, 'skills');
const skills = fs
  .readdirSync(skillsDir)
  .filter((d) => fs.existsSync(path.join(skillsDir, d, 'SKILL.md')))
  .sort()
  .map((d) => ({ dir: d, ...frontmatter(path.join(skillsDir, d, 'SKILL.md')) }));

page(
  'skills.mdx',
  `Skills (${skills.length})`,
  'Every skill the Pit Crew core ships, and when each one loads.',
  `A skill loads when its description matches what the run is doing. You rarely name one: the phase commands load the skills they need. A skill marked **manual** runs only when you type it.

| Skill | Loads | When it is used |
|---|---|---|
${skills
  .map(
    (s) =>
      `| ${code('pit-crew:' + (s.name || s.dir))} | ${s['disable-model-invocation'] === 'true' ? '**manual**' : 'on its own'} | ${cell(s.description)} |`,
  )
  .join('\n')}`,
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
const context = fs.readFileSync(path.join(core, 'CONTEXT.md'), 'utf8');
const glossaryBody = context
  .replace(/^# .*\n/, '')
  .replace(/^(#{1,5}) /gm, (m, h) => `${h}# `.replace(/^#{7,}/, '######') )
  .replace(/[{}]/g, (c) => `\\${c}`)
  .replace(/<(?!\/?(?:br|code|b|i|em|strong)\b)/g, '&lt;');
page(
  'glossary.mdx',
  'Glossary',
  'The vocabulary Pit Crew uses, one meaning per term.',
  `The terms a run uses, as the plugin defines them in its \`CONTEXT.md\`. Each term has one meaning, and the words to avoid for it.

${glossaryBody}`,
);
