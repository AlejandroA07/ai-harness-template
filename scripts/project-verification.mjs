function selectPackageManager(relativeFiles) {
  if (relativeFiles.includes('pnpm-lock.yaml')) return { command: 'pnpm', install: ['install', '--frozen-lockfile'], audit: ['audit', '--audit-level', 'high'] };
  if (relativeFiles.includes('yarn.lock')) return { command: 'yarn', install: ['install', '--immutable'], audit: null };
  if (relativeFiles.includes('bun.lock') || relativeFiles.includes('bun.lockb')) return { command: 'bun', install: ['install', '--frozen-lockfile'], audit: null };
  return { command: 'npm', install: relativeFiles.includes('package-lock.json') ? ['ci'] : ['install'], audit: ['audit', '--audit-level', 'high'] };
}

export function buildVerificationSteps({ hasDotnet, hasNode, isGithub, dotnetTarget, packageJson = {}, relativeFiles = [] }) {
  const steps = [];
  if (hasDotnet) {
    const target = dotnetTarget ? [dotnetTarget] : [];
    const locked = relativeFiles.some((file) => file.endsWith('packages.lock.json'));
    steps.push({ name: 'Restore .NET', command: 'dotnet', args: locked ? ['restore', ...target, '--locked-mode'] : ['restore', ...target] });
    steps.push({ name: 'Build .NET', command: 'dotnet', args: ['build', ...target, '--configuration', 'Release', '--no-restore'] });
    steps.push({ name: 'Format .NET', command: 'dotnet', args: ['format', ...target, '--verify-no-changes', '--no-restore'] });
    steps.push({ name: 'Test .NET', command: 'dotnet', args: ['test', ...target, '--configuration', 'Release', '--no-build'] });
  }
  if (hasNode) {
    const manager = selectPackageManager(relativeFiles);
    steps.push({ name: 'Install Node dependencies', command: manager.command, args: manager.install });
    for (const script of ['build', 'typecheck', 'lint', 'format:check', 'test']) {
      if (packageJson.scripts?.[script]) steps.push({ name: `Node ${script}`, command: manager.command, args: manager.command === 'npm' ? ['run', script] : [script] });
    }
    if (manager.audit) steps.push({ name: 'Audit Node dependencies', command: manager.command, args: manager.audit });
  }
  if (steps.length === 0) steps.push({ name: 'Tailor verification', command: 'node', args: ['-e', "throw new Error('Tailor scripts/verify.mjs for this stack')"] });
  steps.push({ name: 'Gitleaks full-history scan', command: 'gitleaks', args: ['git', '--redact', '-v'] });
  if (isGithub) steps.push({ name: 'GitHub Actions security', command: 'zizmor', args: ['.github/workflows'] });
  return steps;
}

export function selectDotnetTarget(files) {
  const solutions = files.filter((file) => /\.(?:sln|slnx)$/i.test(file));
  const candidates = solutions.length ? solutions : files.filter((file) => /\.csproj$/i.test(file));
  if (candidates.length !== 1) throw new Error('Generated .NET verification requires one unambiguous solution or project');
  return './' + candidates[0];
}
