import assert from 'node:assert/strict';
import test from 'node:test';
import { containsAttribution } from '../components/attribution-policy.mjs';

test('rejects explicit attribution signatures', () => {
  for (const text of [
    'Co-Authored-By: Claude <bot@example.com>',
    'Co-Authored-By: AI Assistant <ai@example.com>',
    'Assisted-By: LLM <bot@example.com>',
    'Generated with Codex',
    'Made with AI',
    'Built by ChatGPT',
    'AI-assisted change',
    'Fix auth 🤖',
  ]) assert.equal(containsAttribution(text), true);
});

test('allows legitimate product discussion', () => {
  assert.equal(containsAttribution('Document OpenAI API behavior'), false);
  assert.equal(containsAttribution('Add AI recommendations page'), false);
});
