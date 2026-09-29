import { execFileSync } from 'node:child_process';
import process from 'node:process';
import {
  commandNeedsCurrentBranch,
  evaluateHook,
  MAX_HOOK_INPUT_BYTES,
  OVERSIZED_HOOK_INPUT_REASON,
  parseHookInput,
} from './guard-policy.mjs';

function deny(reason) {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })}\n`);
}

let rawInput = '';
try {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_HOOK_INPUT_BYTES) {
      deny(OVERSIZED_HOOK_INPUT_REASON);
      process.exit(0);
    }
    chunks.push(buffer);
  }
  rawInput = Buffer.concat(chunks).toString('utf8');
} catch {
  deny('The safety hook could not parse the tool request, so the operation is denied.');
  process.exit(0);
}
const parsed = parseHookInput(rawInput);
if (parsed.reason) {
  deny(parsed.reason);
  process.exit(0);
}
const input = parsed.input;

const command = input.tool_input?.command ?? input.arguments?.command ?? '';
let currentBranch = '';
if (commandNeedsCurrentBranch(command)) {
  try {
    currentBranch = execFileSync('git', ['branch', '--show-current'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();
  } catch {
    currentBranch = '';
  }
}

const reason = evaluateHook(input, currentBranch);
if (reason) deny(reason);
