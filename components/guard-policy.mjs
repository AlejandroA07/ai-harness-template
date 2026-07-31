function containsSensitivePath(value) {
  const normalized = value.replaceAll('\\', '/');
  const envMatches = normalized.match(/(?:^|[\/\s"'])\.env(?:\.[a-zA-Z0-9_-]+)*/g) ?? [];
  for (const match of envMatches) {
    const name = match.trim().replace(/^['"]/, '').split('/').at(-1).toLowerCase();
    if (!['.env.example', '.env.sample', '.env.template'].includes(name)) return true;
  }
  return /(?:^|\/)(?:id_rsa[^/]*|id_ed25519[^/]*|[^/]+\.(?:pem|key|p12|pfx))(?=$|[\s"';&|<>()])/i.test(normalized)
    || /(?:^|\/)\.(?:ssh|aws|azure|config\/gcloud)(?:\/|$)/i.test(normalized);
}

export function evaluateCommitBranch(branch) {
  if (!branch) return 'Commits from detached HEAD are blocked. Switch to a feature/<topic> or research/<topic> branch.';
  if (!/^(?:feature|research)\/[a-zA-Z0-9._/-]+$/.test(branch)) {
    return `Branch '${branch}' is not eligible for agent commits. Use feature/<topic>, or research/<topic> for an approved Wayfinder research task.`;
  }
  return null;
}

export function evaluateHook(input, currentBranch = '') {
  const toolInput = input.tool_input ?? input.arguments ?? {};
  const command = typeof toolInput.command === 'string' ? toolInput.command.trim() : '';
  const filePath = typeof toolInput.file_path === 'string' ? toolInput.file_path : '';

  if (filePath && containsSensitivePath(filePath)) {
    return 'Reading secret-bearing files is blocked. Use the project secret mechanism; example/template env files remain readable.';
  }
  if (!command) return null;
  if (containsSensitivePath(command)) {
    return 'Commands that reference secret-bearing files are blocked. Do not read or print secrets.';
  }

  const destructiveRules = [
    { pattern: /\bgit(?:\.exe)?\b[^\r\n;&|<>]*\breset\b[^\r\n;&|<>]*\s--hard(?=$|[\s;&|<>()])/i, name: 'git reset --hard' },
    { pattern: /\bgit(?:\.exe)?\b[^\r\n;&|<>]*\bclean\b[^\r\n;&|<>]*\s-[a-z]*f[a-z]*(?=$|[\s;&|<>()])/i, name: 'git clean -f' },
    { pattern: /\bgit(?:\.exe)?\b[^\r\n;&|<>]*\bbranch\b[^\r\n;&|<>]*\s-D(?=$|[\s;&|<>()])/i, name: 'git branch -D' },
    { pattern: /\bgit(?:\.exe)?\s+(?:checkout|restore)\s+(?:--\s+)?\.(?=$|[\s;&|<>()])/i, name: 'whole-worktree checkout/restore' },
  ];
  for (const rule of destructiveRules) {
    if (rule.pattern.test(command)) return `${rule.name} is permanently blocked for agents because it can destroy uncommitted work.`;
  }

  if (/\bgit(?:\.exe)?\b[\s\S]*?\bpush\b/i.test(command)) {
    const allowed = command.match(/^git(?:\.exe)?\s+push\s+(?:(?:-u|--set-upstream)\s+)?origin\s+(research\/[a-zA-Z0-9._/-]+)$/i);
    if (!allowed) {
      return 'Feature pushes are blocked. The only agent-eligible form is an explicitly approved `git push origin research/<name>` with no force, tags, deletion, mirror, or extra refspecs.';
    }
    if (!currentBranch || currentBranch.toLowerCase() !== allowed[1].toLowerCase()) {
      return `The pushed research branch must be the current branch (${currentBranch || 'detached HEAD'}).`;
    }
  }
  return null;
}
