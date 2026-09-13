import { isDeepStrictEqual as equal } from 'node:util';
import { object, parseSettings, getSetting, setSetting, hookGroups, hookCount, removeExactHook, pruneContainers } from './global-settings.mjs';
import { encode } from './installation-core.mjs';

const scalars = { autoMemoryEnabled: false, includeCoAuthoredBy: false };
export function projectSettings(bytes, expected, prior, remove = false) {
  const settings = parseSettings(bytes);
  const next = structuredClone(settings);
  const groups = hookGroups(settings);
  if (settings.disableAllHooks === true && !remove) throw new Error('Project hooks are disabled; review settings first');
  if (prior) {
    if (!object(prior) || Object.keys(prior).sort().join(',') !== 'arrayExisted,createdHookContainer,existed,hook,owned,scalars'
      || [prior.existed, prior.arrayExisted, prior.createdHookContainer, prior.owned].some((value) => typeof value !== 'boolean')
      || !object(prior.hook) || Object.keys(prior.hook).sort().join(',') !== 'hooks,matcher'
      || typeof prior.hook.matcher !== 'string' || !Array.isArray(prior.hook.hooks) || prior.hook.hooks.length !== 1
      || !object(prior.hook.hooks[0]) || prior.hook.hooks[0].type !== 'command'
      || typeof prior.hook.hooks[0].command !== 'string' || !object(prior.scalars)) throw new Error('Invalid project settings ownership');
    if (hookCount(groups, prior.hook) !== 1) throw new Error('Project hook was edited, duplicated or removed');
    if (!remove && !prior.owned && !equal(prior.hook, expected)) throw new Error('An unowned project hook cannot be upgraded automatically');
  }
  const state = prior ? structuredClone(prior) : { existed: bytes !== null, arrayExisted: getSetting(settings, ['hooks', 'PreToolUse']).present,
    createdHookContainer: !Object.hasOwn(settings, 'hooks'), owned: hookCount(groups, expected) === 0, hook: expected, scalars: {} };
  const definitions = expected.matcher.includes('PowerShell') ? scalars : {};
  if (prior && Object.keys(prior.scalars).sort().join(',') !== Object.keys(definitions).sort().join(',')) throw new Error('Invalid project scalar ownership');
  for (const [key, value] of Object.entries(definitions)) {
    const actual = getSetting(settings, [key]);
    if (actual.present && typeof actual.value !== 'boolean') throw new Error('Invalid project setting');
    if (prior) {
      const before = prior.scalars[key];
      if (!object(before) || typeof before.present !== 'boolean' || (before.present && typeof before.value !== 'boolean')
        || Object.keys(before).sort().join(',') !== (before.present ? 'present,value' : 'present')) throw new Error('Invalid prior project setting');
      if (!equal(actual, { present: true, value })) throw new Error('Owned project setting was edited');
    } else state.scalars[key] = actual;
    setSetting(next, [key], remove ? state.scalars[key] : { present: true, value });
  }
  const retained = state.owned && (remove || (prior && !equal(prior.hook, expected))) ? removeExactHook(groups, prior?.hook ?? expected) : [...groups];
  if (!remove && !hookCount(retained, expected)) retained.push(expected);
  if (!remove && hookCount(retained, expected) !== 1) throw new Error('Duplicate project hook');
  setSetting(next, ['hooks', 'PreToolUse'], retained.length || state.arrayExisted ? { present: true, value: retained } : { present: false });
  if (remove && state.createdHookContainer) pruneContainers(next, [['hooks']]);
  if (!remove) state.hook = expected;
  const after = equal(settings, next) ? bytes : remove && !state.existed && !Object.keys(next).length ? null : Buffer.from(encode(next));
  return { state, after };
}
