import { object } from './global-settings.mjs';

export const receiptPath = '.harness/project-installation.json';
export const runtimeNames = ['installation-core.mjs', 'installation-evidence.mjs', 'skill-lib.mjs', 'global-settings.mjs', 'project-settings.mjs', 'project-state.mjs', 'project-adapters.mjs', 'project-receipt.mjs', 'project-check.mjs', 'project-provenance.mjs'];
export const componentNames = ['guard-policy.mjs', 'guard-git.mjs', 'attribution-policy.mjs', 'check-attribution.mjs'];
export const sharedPaths = ['AGENTS.md', 'docs/agents/domain.md', 'docs/agents/issue-tracker.md', 'scripts/verify.mjs', 'scripts/verify-harness.mjs',
  '.gitleaks.toml', '.github/workflows/harness-project.yml', '.harness/runtime/windows-cli.mjs',
  ...runtimeNames.map((name) => `.harness/project-runtime/${name}`), ...componentNames.map((name) => `.harness/hooks/${name}`)];
export function filePlatform(file) {
  if (file === 'CLAUDE.md' || file.startsWith('.claude/skills/')) return 'claude';
  if (file.startsWith('.agents/skills/')) return 'codex';
  return null;
}
export function allowedProjectFile(file) {
  if (sharedPaths.includes(file) || file === 'CLAUDE.md') return true;
  const parts = file.split('/');
  return ['.claude', '.agents'].includes(parts[0]) && parts[1] === 'skills' && /^[a-z0-9-]{1,64}$/.test(parts[2] ?? '')
    && parts.length >= 4 && parts.slice(3).every((part) => part && !part.startsWith('.') && !/[\\:\x00-\x1f]/.test(part)
      && !/\.(?:pem|key|p12|pfx)$/i.test(part) && !/^(?:id_rsa|id_ed25519)/i.test(part));
}
export function validateProjectReceipt(value) {
  if (!object(value) || Object.keys(value).sort().join(',') !== 'codexFeatures,ignore,module,options,owned,payload,platforms,profile,scope,settings,version'
    || value.version !== 3 || typeof value.payload !== 'string' || !/^[a-f0-9]{64}$/.test(value.payload) || value.module !== 'project-configuration' || value.scope !== 'project' || value.profile !== 'coexistence'
    || !Array.isArray(value.platforms) || !value.platforms.length || value.platforms.some((name) => !['codex', 'claude'].includes(name))
    || new Set(value.platforms).size !== value.platforms.length || !object(value.owned) || !object(value.settings)
    || Object.keys(value.settings).sort().join(',') !== [...value.platforms].sort().join(',')) throw new Error('Invalid project receipt');
  if (!object(value.ignore) || (value.platforms.includes('codex') ? !object(value.codexFeatures) : value.codexFeatures !== null)) throw new Error('Invalid scoped project state');
  for (const [file, hash] of Object.entries(value.owned)) {
    if (!allowedProjectFile(file) || (filePlatform(file) && !value.platforms.includes(filePlatform(file)))
      || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid project file ownership');
  }
  if (!object(value.options) || Object.keys(value.options).sort().join(',') !== 'ci,domainLayout,tracker,verification'
    || !['none', 'github'].includes(value.options.ci) || !['single', 'multi'].includes(value.options.domainLayout)
    || !['local', 'github'].includes(value.options.tracker) || !['existing', 'generated'].includes(value.options.verification)) throw new Error('Invalid project options');
  const required = ['scripts/verify-harness.mjs', '.harness/runtime/windows-cli.mjs',
    ...runtimeNames.map((name) => `.harness/project-runtime/${name}`), ...componentNames.map((name) => `.harness/hooks/${name}`),
    ...(value.options.verification === 'generated' ? ['scripts/verify.mjs'] : []), ...(value.options.ci === 'github' ? ['.github/workflows/harness-project.yml'] : [])];
  if (required.some((file) => !Object.hasOwn(value.owned, file))) throw new Error('Project receipt is missing required runtime ownership');
  return value;
}
