import { isDeepStrictEqual } from 'node:util';

export function mergeUnique(existing = [], additions = []) {
  return [...new Set([...existing, ...additions])];
}

export function reconcileHarnessDenials(existing = [], additions = [], obsolete = []) {
  const retired = new Set(obsolete);
  return mergeUnique(existing.filter((rule) => !retired.has(rule)), additions);
}

export function replaceHarnessHook(groups = [], replacement) {
  const retained = [];
  for (const group of groups) {
    if (!Array.isArray(group.hooks)) {
      retained.push(group);
      continue;
    }
    const { hooks: existingHooks, ...context } = group;
    const { hooks: expectedHooks, ...expectedContext } = replacement;
    const hooks = existingHooks.filter((hook) => !(isDeepStrictEqual(context, expectedContext)
      && expectedHooks.some((expected) => isDeepStrictEqual(hook, expected))));
    if (hooks.length === group.hooks.length) retained.push(group);
    else if (hooks.length > 0) retained.push({ ...group, hooks });
  }
  return [...retained, replacement];
}

export function hasHarnessHook(groups = [], expected) {
  const { hooks: expectedHooks, ...expectedContext } = expected;
  return Array.isArray(groups) && groups.some(({ hooks, ...context }) =>
    isDeepStrictEqual(context, expectedContext) && Array.isArray(hooks)
    && expectedHooks.every((entry) => hooks.some((hook) => isDeepStrictEqual(hook, entry))));
}
