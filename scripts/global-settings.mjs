import { isDeepStrictEqual as equal } from 'node:util';

export function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function parseSettings(bytes) {
  if (bytes === null) return {};
  try {
    const value = JSON.parse(bytes.toString('utf8'));
    if (!object(value)) throw new Error();
    return value;
  } catch { throw new Error('Settings must be a JSON object; review the file before migration'); }
}
export function getSetting(value, keys) {
  let current = value;
  for (const key of keys) {
    if (!object(current)) throw new Error('Settings container has an incompatible type');
    if (!Object.hasOwn(current, key)) return { present: false };
    current = current[key];
  }
  return { present: true, value: current };
}
export function setSetting(value, keys, state) {
  let current = value;
  for (const key of keys.slice(0, -1)) {
    if (!Object.hasOwn(current, key)) {
      if (!state.present) return;
      current[key] = {};
    }
    if (!object(current[key])) throw new Error('Settings container has an incompatible type');
    current = current[key];
  }
  if (state.present) current[keys.at(-1)] = structuredClone(state.value);
  else delete current[keys.at(-1)];
}
export function pruneContainers(settings, created) {
  for (const keys of [...created].sort((a, b) => b.length - a.length)) {
    const current = getSetting(settings, keys);
    if (current.present && object(current.value) && !Object.keys(current.value).length) setSetting(settings, keys, { present: false });
  }
}
export function hookCount(groups, expected) {
  const { hooks: expectedHooks, ...context } = expected;
  return groups.reduce((count, { hooks, ...other }) => count + (equal(context, other)
    ? hooks.filter((entry) => equal(entry, expectedHooks[0])).length : 0), 0);
}
export function removeExactHook(groups, expected) {
  const { hooks: expectedHooks, ...context } = expected;
  return groups.flatMap(({ hooks, ...other }) => {
    if (!equal(context, other)) return [{ ...other, hooks }];
    const retained = hooks.filter((entry) => !equal(entry, expectedHooks[0]));
    return retained.length ? [{ ...other, hooks: retained }] : [];
  });
}
export function hookGroups(settings) {
  const state = getSetting(settings, ['hooks', 'PreToolUse']);
  const groups = state.present ? state.value : [];
  if (!Array.isArray(groups) || groups.some((group) => !object(group) || !Array.isArray(group.hooks)
    || group.hooks.some((hook) => !object(hook)))) throw new Error('Incompatible PreToolUse hook schema');
  return groups;
}

// This editor recognizes TOML statement boundaries without rewriting unrelated
// values. Only ordinary boolean feature assignments are mutable; ambiguous
// inline feature tables and deprecated hook aliases require explicit migration.
function dottedKey(text) {
  const keys = [];
  let rest = text.trim();
  while (rest) {
    const match = rest.match(/^(?:([A-Za-z0-9_-]+)|"((?:[^"\\]|\\.)*)"|'([^']*)')\s*/);
    if (!match) throw new Error('Unsupported TOML key syntax');
    keys.push(match[1] ?? (match[2] !== undefined ? JSON.parse(`"${match[2]}"`) : match[3]));
    rest = rest.slice(match[0].length);
    if (!rest) break;
    if (!rest.startsWith('.')) throw new Error('Unsupported TOML key syntax');
    rest = rest.slice(1).trimStart();
    if (!rest) throw new Error('Unsupported TOML key syntax');
  }
  if (!keys.length) throw new Error('Empty TOML key');
  return keys;
}
function statements(text) {
  const result = [];
  let start = 0, quote = '', depth = 0, comment = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (comment) { if (char !== '\n') continue; comment = false; }
    else if (quote) {
      if (quote.startsWith('"') && char === '\\') { index++; continue; }
      if (text.startsWith(quote, index)) { index += quote.length - 1; quote = ''; }
      else if (char === '\n' && quote.length === 1) throw new Error('Unterminated TOML string');
      continue;
    } else if (char === '"' || char === "'") {
      quote = text.startsWith(char.repeat(3), index) ? char.repeat(3) : char;
      index += quote.length - 1;
      continue;
    } else if (char === '#') { comment = true; continue; }
    else if (char === '[' || char === '{') depth++;
    else if (char === ']' || char === '}') depth--;
    if (depth < 0) throw new Error('Unbalanced TOML statement');
    if (char === '\n' && !depth) { result.push({ start, end: index + 1, raw: text.slice(start, index + 1) }); start = index + 1; }
  }
  if (quote || depth) throw new Error('Unterminated TOML statement');
  if (start < text.length) result.push({ start, end: text.length, raw: text.slice(start) });
  return result;
}
function splitAssignment(raw) {
  let quote = '';
  for (let index = 0; index < raw.length; index++) {
    const char = raw[index];
    if (quote) {
      if (quote === '"' && char === '\\') { index++; continue; }
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '#' || char === '\n' || char === '\r') break;
    else if (char === '=') return { key: raw.slice(0, index), value: raw.slice(index + 1) };
  }
  throw new Error('Unsupported TOML assignment');
}
export function inspectFeatures(text) {
  const values = { hooks: null, memories: null };
  const assignments = {};
  let table = [], featureHeader = null;
  const parsed = statements(text);
  for (const statement of parsed) {
    const trimmed = statement.raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('[')) {
      const header = trimmed.match(/^(\[\[?)(.*?)(\]\]?)\s*(?:#.*)?$/);
      if (!header || header[1].length !== header[3].length) throw new Error('Unsupported TOML table');
      table = dottedKey(header[2]);
      if (table[0] === 'features') {
        if (header[1] !== '[' || ['hooks', 'memories', 'codex_hooks'].includes(table[1])) throw new Error('Ambiguous feature table; review migration');
        if (table.length === 1) {
          if (featureHeader) throw new Error('Duplicate feature table');
          featureHeader = statement;
        }
      }
      continue;
    }
    const assignment = splitAssignment(statement.raw);
    const keys = [...table, ...dottedKey(assignment.key)];
    if (keys[0] !== 'features') continue;
    if (!table.length) throw new Error('Use an explicit [features] table before migration');
    if (keys.length === 1 || keys[1] === 'codex_hooks') throw new Error('Inline features or deprecated hook aliases require migration');
    if (!['hooks', 'memories'].includes(keys[1])) continue;
    const key = keys[1];
    if (keys.length !== 2 || assignments[key]) throw new Error('Duplicate or nested feature setting');
    const value = assignment.value.match(/^(\s*)(true|false)(\s*(?:#[^\r\n]*)?\r?\n?)$/);
    if (!value) throw new Error('Owned feature settings must be booleans');
    const prefix = statement.raw.slice(0, statement.raw.length - assignment.value.length) + value[1];
    assignments[key] = { ...statement, prefix, suffix: value[3] };
    values[key] = value[2] === 'true';
  }
  return { values, assignments, featureHeader, parsed };
}
export function editFeatures(text, desired, removeCreatedTable = false) {
  const info = inspectFeatures(text);
  const edits = [];
  const additions = [];
  for (const key of ['hooks', 'memories']) {
    const assignment = info.assignments[key];
    if (assignment) edits.push({ start: assignment.start, end: assignment.end,
      text: desired[key] === null ? '' : `${assignment.prefix}${desired[key]}${assignment.suffix}` });
    else if (desired[key] !== null) additions.push(`${key} = ${desired[key]}\n`);
  }
  if (additions.length) {
    const at = info.featureHeader?.end ?? text.length;
    edits.push({ start: at, end: at, text: info.featureHeader
      ? `${text[at - 1] === '\n' ? '' : '\n'}${additions.join('')}`
      : `${text && !text.endsWith('\n') ? '\n' : ''}[features]\n${additions.join('')}` });
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  if (removeCreatedTable) {
    const current = inspectFeatures(text);
    if (current.featureHeader) {
      const index = current.parsed.indexOf(current.featureHeader);
      const tail = current.parsed.slice(index + 1);
      const nextTable = tail.findIndex((item) => item.raw.trimStart().startsWith('['));
      if (tail.slice(0, nextTable < 0 ? tail.length : nextTable).every((item) => !item.raw.trim() || item.raw.trimStart().startsWith('#'))) {
        text = text.slice(0, current.featureHeader.start) + text.slice(current.featureHeader.end);
      }
    }
  }
  return text;
}
