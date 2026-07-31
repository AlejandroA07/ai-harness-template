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
    const hooks = group.hooks.filter((hook) => !String(hook.command ?? '').includes('guard-git.mjs'));
    if (hooks.length === group.hooks.length) retained.push(group);
    else if (hooks.length > 0) retained.push({ ...group, hooks });
  }
  return [...retained, replacement];
}
