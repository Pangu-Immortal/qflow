import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPOSITORY = 'qflow-ai/qflow';

// This client has no mutation method. Its GitHub token is read-only as well.
export function githubRead(token = process.env.GH_TOKEN, request = fetch) {
  if (!token) throw new Error('GH_TOKEN is required');
  return async path => {
    if (!path.startsWith(`/repos/${REPOSITORY}/`)) throw new Error('Read is outside this repository');
    const response = await request(`https://api.github.com${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub read returned ${response.status}`);
    return response.json();
  };
}

async function pages(read, path) {
  const items = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await read(`${path}?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('Expected a GitHub list');
    items.push(...batch);
    if (batch.length < 100) return items;
  }
  throw new Error('Requested discussion exceeds this workflow’s read budget');
}

export async function prepare(read, kind, input) {
  if (!['issue', 'pr'].includes(kind) || !/^[1-9]\d*$/.test(String(input))) {
    throw new Error('Select issue or pr and a positive number');
  }
  const number = Number(input);
  if (!Number.isSafeInteger(number)) throw new Error('Invalid issue or PR number');
  const path = `/repos/${REPOSITORY}`;
  const item = await read(`${path}/${kind === 'pr' ? 'pulls' : 'issues'}/${number}`);
  if (kind === 'issue' && item.pull_request) throw new Error('Select pr for a pull request');
  const comments = (await pages(read, `${path}/issues/${number}/comments`)).filter(c => c.user?.type !== 'Bot');
  const selectedComments = comments.slice(-20);
  const context = {
    repository: REPOSITORY, kind, number, title: item.title, state: item.state,
    body: (item.body ?? '').slice(0, 20_000),
    comments: selectedComments.map(c => ({ author: c.user.login, body: c.body.slice(0, 2000) })),
    omitted_comments: comments.length - selectedComments.length,
    text_truncated: (item.body ?? '').length > 20_000 || selectedComments.some(c => c.body.length > 2000),
  };
  if (kind === 'issue') return context;
  const files = await pages(read, `${path}/pulls/${number}/files`);
  const selected = [];
  let remaining = 120_000;
  for (const file of files) {
    if (!file.patch || selected.length >= 50 || file.patch.length > remaining) continue;
    selected.push({ path: file.filename, status: file.status, patch: file.patch });
    remaining -= file.patch.length;
  }
  return { ...context, head: item.head.sha, base: item.base.sha, files: selected,
    total_files: files.length, omitted_files: files.length - selected.length };
}

// The model receives only text. No tools, GitHub token or executable output are supplied.
export async function analyze(context, { key, model, maxTokens }, request = fetch) {
  if (!key || !model || !Number.isSafeInteger(maxTokens) || maxTokens <= 0) {
    throw new Error('Configure DEEPSEEK_API_KEY, ANALYSIS_MODEL and ANALYSIS_MAX_TOKENS');
  }
  const response = await request('https://api.deepseek.com/chat/completions', {
    method: 'POST', redirect: 'error',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, stream: false, messages: [
      { role: 'system', content: readFileSync(new URL('./analysis-prompt.md', import.meta.url), 'utf8') },
      { role: 'user', content: JSON.stringify(context) },
    ] }),
    signal: AbortSignal.timeout(300_000),
  });
  // Do not print a provider error body: it is neither the analysis nor safe diagnostic context.
  if (!response.ok) throw new Error(`DeepSeek request failed (HTTP ${response.status})`);
  const output = await response.json();
  const choice = output.choices?.[0];
  if (choice?.finish_reason !== 'stop' || typeof choice.message?.content !== 'string' || !choice.message.content.trim()) {
    throw new Error('DeepSeek did not return a complete analysis');
  }
  return choice.message.content;
}

export function writeReport(analysis, context, destination) {
  if (!destination) throw new Error('GITHUB_STEP_SUMMARY is required');
  const title = `${context.kind === 'pr' ? 'PR' : 'Issue'} #${context.number}`;
  const revision = context.kind === 'pr' ? `\nHead: ${context.head}\nBase: ${context.base}\n` : '';
  // Treat all model output as text. It is never evaluated as code or sent to a GitHub write API.
  const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  appendFileSync(destination, `## Analysis of ${title}\n${revision}\n<pre>${escape(analysis)}</pre>\n`);
}

async function main() {
  const contextPath = process.env.ANALYSIS_CONTEXT;
  if (!contextPath) throw new Error('ANALYSIS_CONTEXT is required');
  if (process.argv[2] === 'prepare') {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    if (event.repository?.full_name !== REPOSITORY) throw new Error('Unexpected repository');
    const context = await prepare(githubRead(), event.inputs?.kind, event.inputs?.number);
    mkdirSync(dirname(contextPath), { recursive: true });
    writeFileSync(contextPath, JSON.stringify(context));
  } else if (process.argv[2] === 'analyze') {
    const context = JSON.parse(readFileSync(contextPath, 'utf8'));
    const analysis = await analyze(context, {
      key: process.env.DEEPSEEK_API_KEY,
      model: process.env.ANALYSIS_MODEL,
      maxTokens: Number(process.env.ANALYSIS_MAX_TOKENS),
    });
    writeReport(analysis, context, process.env.GITHUB_STEP_SUMMARY);
  } else throw new Error('Expected prepare or analyze');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
