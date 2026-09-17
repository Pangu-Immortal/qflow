import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { analyze, githubRead, prepare, writeReport } from './analysis.mjs';

const repo = '/repos/qflow-ai/qflow';
const issue = { title: 'Question', body: 'Observed behavior', state: 'closed' };
const comment = { body: 'Additional evidence', user: { login: 'author', type: 'User' } };

test('GitHub access is GET-only, repository-scoped, and failures do not echo credentials', async () => {
  const calls = [];
  const read = githubRead('test-token', async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => issue };
  });
  await read(`${repo}/issues/1`);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.body, undefined);
  await assert.rejects(read('/repos/another/repository/issues/1'), /outside this repository/);
  assert.equal(calls.length, 1);
  const failed = githubRead('test-token', async () => ({ ok: false, status: 401, text: () => 'test-token' }));
  await assert.rejects(failed(`${repo}/issues/1`), { message: 'GitHub read returned 401' });
});

test('explicit analysis reads closed issues and does not depend on bot state or labels', async () => {
  const paths = [];
  const read = async path => {
    paths.push(path);
    if (path === `${repo}/issues/1`) return issue;
    if (path === `${repo}/issues/1/comments?per_page=100&page=1`) return [comment];
    throw new Error(path);
  };
  const context = await prepare(read, 'issue', '1');
  assert.equal(context.state, 'closed');
  assert.equal(context.comments[0].body, comment.body);
  assert.deepEqual(paths, [`${repo}/issues/1`, `${repo}/issues/1/comments?per_page=100&page=1`]);
});

test('repeated PR analysis reads the current base again and retains deletion diffs', async () => {
  let base = 'base-one';
  let reads = 0;
  const read = async path => {
    if (path === `${repo}/pulls/2`) { reads++; return { ...issue, head: { sha: 'same-head' }, base: { sha: base } }; }
    if (path.includes('/comments?')) return [];
    if (path.includes('/files?')) return [
      { filename: 'removed.ts', status: 'removed', patch: '@@ -1 +0,0 @@\n-export const value = 1;' },
      { filename: 'image.png', status: 'added' },
    ];
    throw new Error(path);
  };
  const first = await prepare(read, 'pr', '2');
  base = 'base-two';
  const second = await prepare(read, 'pr', '2');
  assert.equal(reads, 2);
  assert.equal(first.base, 'base-one');
  assert.equal(second.base, 'base-two');
  assert.equal(second.files[0].status, 'removed');
  assert.equal(second.omitted_files, 1);
});

test('model receives text only, without tools or credentials in its messages', async () => {
  let body;
  const result = await analyze(issue, { key: 'private-test-key', model: 'selected-model', maxTokens: 1000 }, async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer private-test-key');
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'Analysis' } }] }) };
  });
  assert.equal(result, 'Analysis');
  assert.equal(body.model, 'selected-model');
  assert.equal(body.tools, undefined);
  assert.equal(body.messages.some(m => m.content.includes('private-test-key')), false);
});

test('provider failure and incomplete output do not become successful reports or retries', async () => {
  const settings = { key: 'private-test-key', model: 'selected-model', maxTokens: 1000 };
  let calls = 0;
  await assert.rejects(analyze(issue, settings, async () => {
    calls++; return { ok: false, status: 429, text: async () => 'private-test-key' };
  }), { message: 'DeepSeek request failed (HTTP 429)' });
  assert.equal(calls, 1);
  await assert.rejects(analyze(issue, settings, async () => ({ ok: true, json: async () => ({
    choices: [{ finish_reason: 'length', message: { content: 'Incomplete' } }],
  }) })), /complete analysis/);
});

test('report output remains text in the Actions summary', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qflow-analysis-'));
  try {
    const destination = join(directory, 'summary.md');
    writeReport('<script>doSomething()</script> & ::warning::text', { kind: 'issue', number: 1 }, destination);
    const result = await readFile(destination, 'utf8');
    assert.match(result, /&lt;script&gt;doSomething\(\)&lt;\/script&gt; &amp;/);
    assert.match(result, /Analysis of Issue #1/);
    assert.equal(result.includes('<script>'), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
