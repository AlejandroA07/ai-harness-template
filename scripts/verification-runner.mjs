import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const control = /[\u0000-\u001f\u007f]+/g;
const ansi = /\u001b\[[0-?]*[ -/]*[@-~]/g;

function cleanLine(value, limit = 500) {
  return String(value).replace(ansi, '').replace(control, ' ').trim().slice(0, limit);
}

function text(value) {
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return '';
}

function warningLines(label, output) {
  const found = [];
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const cleaned = cleanLine(line);
    if (!cleaned || /\b0\s+warnings?\b/i.test(cleaned)) continue;
    if (/\bwarn(?:ing)?\b/i.test(cleaned)) found.push(`${label}: ${cleaned}`);
  }
  const skipped = [...output.matchAll(/\bskipped\s+([1-9]\d*)\b/gi)].map((match) => Number(match[1]));
  if (skipped.length) found.push(`${label}: ${Math.max(...skipped)} checks skipped.`);
  return found;
}

function diagnostic(output, error) {
  if (error) return cleanLine(error.message || error);
  const lines = output.split(/\r?\n/).map((line) => cleanLine(line)).filter(Boolean);
  if (!lines.length) return 'The command failed without diagnostic output.';
  const marker = lines.findIndex((line) => /(?:^|\s)(?:fail(?:ed)?\b|error\b|not ok\b|npm err!\b|✖|×)/i.test(line));
  const excerpt = marker >= 0 ? lines.slice(marker, marker + 12) : lines.slice(-12);
  const joined = excerpt.join('\n');
  return joined.length <= 4000 ? joined : `${joined.slice(0, 3997)}...`;
}

function write(stream, value) {
  stream.write(value.endsWith('\n') ? value : `${value}\n`);
}

function failureLog(records, temporaryRoot) {
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'ai-harness-verification-'));
  const file = path.join(directory, 'verification.log');
  const body = records.map(({ label, stdout, stderr, error }) => [
    `==> ${label}`,
    stdout,
    stderr,
    error ? `Runner error: ${error.message || error}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
  fs.writeFileSync(file, `${body}\n`, { encoding: 'utf8', mode: 0o600 });
  return file;
}

export function runVerification({
  steps,
  execute,
  argv = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  temporaryRoot = os.tmpdir(),
  timeoutMs = 10 * 60 * 1000,
}) {
  if (!Array.isArray(argv) || argv.some((argument) => argument !== '--verbose') || argv.filter((argument) => argument === '--verbose').length > 1) {
    write(stderr, 'Usage: node scripts/verify.mjs [--verbose]');
    return { status: 2, warnings: [], logPath: null };
  }
  if (!Array.isArray(steps) || typeof execute !== 'function') throw new TypeError('Verification requires steps and an executor.');

  const verbose = argv.includes('--verbose');
  const records = [];
  const warnings = [];
  for (const step of steps) {
    const label = cleanLine(step?.name, 120) || 'Unnamed verification stage';
    let result;
    try {
      result = execute(step, { timeoutMs });
    } catch (error) {
      result = { status: 1, error };
    }
    const stdoutText = text(result?.stdout);
    const stderrText = text(result?.stderr);
    const combined = [stdoutText, stderrText].filter(Boolean).join('\n');
    records.push({ label, stdout: stdoutText, stderr: stderrText, error: result?.error });

    if (verbose) {
      write(stdout, `\n==> ${label}`);
      if (stdoutText) stdout.write(stdoutText.endsWith('\n') ? stdoutText : `${stdoutText}\n`);
      if (stderrText) stderr.write(stderrText.endsWith('\n') ? stderrText : `${stderrText}\n`);
    }

    if (result?.error || result?.status !== 0) {
      const logPath = failureLog(records, temporaryRoot);
      write(stderr, `FAIL: ${label}`);
      write(stderr, diagnostic(combined, result?.error));
      write(stderr, `Full log: ${logPath}`);
      return { status: result?.status || 1, warnings: [...new Set(warnings)], logPath };
    }
    warnings.push(...warningLines(label, combined));
  }

  const uniqueWarnings = [...new Set(warnings)];
  if (!uniqueWarnings.length) {
    write(stdout, 'PASS');
    return { status: 0, warnings: [], logPath: null };
  }
  write(stdout, 'PASS WITH WARNINGS');
  for (const warning of uniqueWarnings.slice(0, 10)) write(stdout, `- ${warning}`);
  if (uniqueWarnings.length > 10) write(stdout, `- ${uniqueWarnings.length - 10} additional warnings hidden; use --verbose to inspect them.`);
  return { status: 0, warnings: uniqueWarnings, logPath: null };
}
