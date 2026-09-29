import assert from 'node:assert/strict';
import test from 'node:test';
import { containsAttribution, hasToolBrandedBranchName } from '../components/attribution-policy.mjs';

test('rejects explicit attribution signatures', () => {
  for (const text of [
    'Co-Authored-By: Claude <bot@example.com>',
    'Co-Authored-By: AI Assistant <ai@example.com>',
    'Assisted-By: LLM <bot@example.com>',
    'Generated with Codex',
    'Made with AI',
    'Built by ChatGPT',
    'Authored by Codex',
    'Codex authored this report',
    'AI-Assisted-By: Claude',
  ]) assert.equal(containsAttribution(text), true);
});

test('allows legitimate product discussion', () => {
  assert.equal(containsAttribution('Document OpenAI API behavior'), false);
  assert.equal(containsAttribution('Add AI recommendations page'), false);
  assert.equal(containsAttribution('feat: AI-generated summaries endpoint'), false);
  assert.equal(containsAttribution('Document AI-assisted review mode'), false);
  assert.equal(containsAttribution("Claude adapters are generated with Claude's invocation metadata"), false);
  assert.equal(containsAttribution('Status: ready-for-agent'), false);
  assert.equal(containsAttribution('Prepare an agent brief'), false);
  assert.equal(containsAttribution('Fix auth 🤖'), false);
});

test('rejects only tool-branded branch prefixes', () => {
  for (const branch of ['codex/fix-auth', 'Claude-update', 'refs/heads/chatgpt/docs', 'gpt-6/test']) {
    assert.equal(hasToolBrandedBranchName(branch), true);
  }
  for (const branch of ['feature/fix-auth', 'research/openai-api', 'feature/claude-adapter', 'main']) {
    assert.equal(hasToolBrandedBranchName(branch), false);
  }
});
