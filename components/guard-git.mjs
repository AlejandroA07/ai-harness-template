import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { evaluateHook } from './guard-policy.mjs';

let input = {};
try {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  input = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
} catch {
  process.exit(0);
}

const command = input.tool_input?.command ?? input.arguments?.command ?? '';
let currentBranch = '';
if (/\bgit(?:\.exe)?\b[\s\S]*?\bpush\b/i.test(command)) {
  try {
    currentBranch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
  } catch {
    currentBranch = '';
  }
}

const reason = evaluateHook(input, currentBranch);
if (reason) {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })}\n`);
}
