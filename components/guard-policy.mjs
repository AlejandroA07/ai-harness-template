function containsSensitivePath(value) {
  const normalized = value.replaceAll('\\', '/');
  const envMatches = normalized.match(/(?:^|[\/\s"'])\.env(?:\.[a-zA-Z0-9_-]+)*/g) ?? [];
  for (const match of envMatches) {
    const name = match.trim().replace(/^['"]/, '').split('/').at(-1).toLowerCase();
    if (!['.env.example', '.env.sample', '.env.template'].includes(name)) return true;
  }
  return /(?:^|\/)(?:id_rsa[^/]*|id_ed25519[^/]*|[^/]+\.(?:pem|key|p12|pfx))(?=$|[\s"';&|<>()])/i.test(normalized)
    || /(?:^|\/)\.(?:ssh|aws|azure|kube|gnupg|config\/gcloud)(?:\/|$)/i.test(normalized)
    || /(?:^|\/)\.claude\/\.credentials\.json(?=$|[\s"';&|<>()])/i.test(normalized)
    || /(?:^|\/)\.config\/gh\/hosts\.yml(?=$|[\s"';&|<>()])/i.test(normalized)
    || /(?:^|\/)\.docker\/config\.json(?=$|[\s"';&|<>()])/i.test(normalized)
    || /(?:^|\/)\.npmrc(?=$|[\s"';&|<>()])/i.test(normalized)
    || /(?:^|[\/\s"'])(?:service[-_.]?account(?:[-_.]key)?|application_default_credentials)\.json(?=$|[\s"';&|<>()])/i.test(normalized);
}

function shellCommands(value) {
  const commands = [];
  let words = [];
  let token = '';
  let quote = '';
  let redirect = false;

  function pushToken() {
    if (token) words.push(token);
    token = '';
  }
  function pushCommand() {
    pushToken();
    if (words.length) commands.push(words);
    words = [];
  }

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (redirect) {
      if (quote) {
        if (character === quote) quote = '';
        else if (character === '\\' && quote === '"' && index + 1 < value.length) index += 1;
        continue;
      }
      if (character === '"' || character === "'") { quote = character; continue; }
      if (/\s/.test(character)) { redirect = false; continue; }
      if (';&|()'.includes(character)) {
        redirect = false;
        pushCommand();
      }
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      else if (character === '\\' && quote === '"' && index + 1 < value.length) token += value[index += 1];
      else token += character;
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '\\' && index + 1 < value.length) { token += value[index += 1]; continue; }
    if (/\s/.test(character)) {
      if (character === '\n' || character === '\r') pushCommand();
      else pushToken();
      continue;
    }
    if (character === '>' || character === '<' || (character === '&' && value[index + 1] === '>')) {
      pushToken();
      redirect = true;
      if (value[index + 1] === character || character === '&') index += 1;
      continue;
    }
    if (';&|()'.includes(character)) {
      pushCommand();
      if ((character === '&' || character === '|') && value[index + 1] === character) index += 1;
      continue;
    }
    token += character;
  }
  pushCommand();
  return commands;
}

function commandInvocations(command, depth = 0) {
  if (depth > 2) return [];
  const invocations = [];
  for (const words of shellCommands(command)) {
    let index = 0;
    while (index < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index])) index += 1;
    if (words[index]?.toLowerCase() === 'env') {
      index += 1;
      while (index < words.length && (words[index].startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index]))) {
        if (['-u', '--unset', '-c', '--chdir'].includes(words[index].toLowerCase())) index += 1;
        index += 1;
      }
    }
    while (['command', 'builtin'].includes(words[index]?.toLowerCase())) index += 1;
    if (index >= words.length) continue;
    const executable = words[index].replaceAll('\\', '/').split('/').at(-1).toLowerCase();
    const args = words.slice(index + 1);
    if (['sh', 'bash', 'zsh'].includes(executable)) {
      const commandIndex = args.findIndex((arg) => /^-[a-z]*c[a-z]*$/i.test(arg) || arg === '--command');
      if (commandIndex >= 0 && args[commandIndex + 1]) invocations.push(...commandInvocations(args[commandIndex + 1], depth + 1));
      continue;
    }
    if (['powershell', 'powershell.exe', 'pwsh', 'pwsh.exe'].includes(executable)) {
      const commandIndex = args.findIndex((arg) => ['-command', '-c'].includes(arg.toLowerCase()));
      if (commandIndex >= 0 && args[commandIndex + 1]) invocations.push(...commandInvocations(args[commandIndex + 1], depth + 1));
      continue;
    }
    invocations.push({ executable, args });
  }
  return invocations;
}

function gitInvocations(command) {
  const invocations = [];
  for (const invocation of commandInvocations(command)) {
    if (!['git', 'git.exe'].includes(invocation.executable)) continue;
    const words = invocation.args;
    let index = 0;
    const prefixArgs = [];
    while (index < words.length && words[index].startsWith('-')) {
      const option = words[index];
      prefixArgs.push(option);
      index += 1;
      if (['-c', '-C', '--git-dir', '--work-tree', '--namespace', '--exec-path'].includes(option) && !option.includes('=')) {
        if (index < words.length) prefixArgs.push(words[index]);
        index += 1;
      }
    }
    if (index < words.length) invocations.push({
      subcommand: words[index].toLowerCase(),
      args: words.slice(index + 1),
      prefixArgs,
    });
  }
  return invocations;
}

function ghInvocations(command) {
  const invocations = [];
  for (const invocation of commandInvocations(command)) {
    if (!['gh', 'gh.exe'].includes(invocation.executable)) continue;
    let index = 0;
    while (index < invocation.args.length && invocation.args[index].startsWith('-')) {
      const option = invocation.args[index];
      index += 1;
      if (['-R', '--repo', '--hostname', '--config-dir'].includes(option) && !option.includes('=')) index += 1;
    }
    if (index < invocation.args.length) invocations.push({
      subcommand: invocation.args[index].toLowerCase(),
      args: invocation.args.slice(index + 1),
    });
  }
  return invocations;
}

function hasFlag(args, shortName, longName) {
  return args.some((arg) => arg.toLowerCase() === longName
    || (arg.startsWith('-') && !arg.startsWith('--') && arg.slice(1).toLowerCase().includes(shortName)));
}

function destructiveGitReason(command) {
  for (const { subcommand, args, prefixArgs } of gitInvocations(command)) {
    const lower = args.map((arg) => arg.toLowerCase());
    if (subcommand === 'reset' && lower.some((arg) => ['--hard', '--merge', '--keep'].includes(arg))) return 'destructive git reset mode';
    if (subcommand === 'clean' && hasFlag(args, 'f', '--force')) return 'git clean --force';
    if (subcommand === 'branch' && (args.includes('-D') || (hasFlag(args, 'd', '--delete') && hasFlag(args, 'f', '--force')))) return 'forced git branch deletion';
    if (subcommand === 'checkout' && (hasFlag(args, 'f', '--force') || lower.includes('.'))) return 'destructive whole-worktree checkout';
    if (subcommand === 'restore' && lower.includes('.')) return 'destructive whole-worktree restore';
    if (subcommand === 'rm' && lower.includes('.') && hasFlag(args, 'r', '--recursive')) return 'recursive git removal of the whole worktree';
    if (subcommand === 'stash' && lower[0] === 'clear') return 'git stash clear';
    if (subcommand === 'worktree' && lower[0] === 'remove' && hasFlag(args, 'f', '--force')) return 'forced git worktree removal';
    if (subcommand === 'commit' && hasFlag(args, 'n', '--no-verify')) return 'commit hook bypass';
    if (subcommand === 'commit' && prefixArgs.some((arg, index) => {
      const value = arg.toLowerCase();
      return value.startsWith('-ccore.hookspath=')
        || (value === '-c' && prefixArgs[index + 1]?.toLowerCase().startsWith('core.hookspath='));
    })) return 'commit hook-path override';
    if (subcommand === 'config' && lower.some((arg) => arg === 'core.hookspath' || arg.startsWith('core.hookspath='))) return 'Git hook-path modification';
  }
  return null;
}

function apiRequest(args) {
  let endpoint = '';
  let method = 'GET';
  let body = false;
  const valueOptions = new Set(['--hostname', '--cache', '--jq', '-q', '--template', '-t', '--preview']);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const lower = arg.toLowerCase();
    if (['--method', '-x'].includes(lower)) { method = (args[index += 1] ?? '').toUpperCase(); continue; }
    if (lower.startsWith('--method=')) { method = arg.slice(arg.indexOf('=') + 1).toUpperCase(); continue; }
    if (/^-x.+/i.test(arg)) { method = arg.slice(2).toUpperCase(); continue; }
    if (['--field', '-f', '--raw-field', '-F'].includes(arg)) { body = true; index += 1; continue; }
    if (/^(?:--field=|--raw-field=|-f.+|-F.+)/.test(arg)) { body = true; continue; }
    if (lower === '--input') { body = true; index += 1; continue; }
    if (lower.startsWith('--input=')) { body = true; continue; }
    if (valueOptions.has(arg)) { index += 1; continue; }
    if ([...valueOptions].some((option) => lower.startsWith(`${option}=`))) continue;
    if (!arg.startsWith('-') && !endpoint) endpoint = arg;
  }
  if (method === 'GET' && body) method = 'POST';
  return { endpoint, method };
}

function destructiveGhReason(command) {
  for (const { subcommand, args } of ghInvocations(command)) {
    const action = args[0]?.toLowerCase() ?? '';
    const lower = args.map((arg) => arg.toLowerCase());
    if (['delete', 'remove'].includes(action)) return `GitHub ${subcommand} ${action}`;
    if (subcommand === 'api') {
      const { endpoint, method } = apiRequest(args);
      if (method === 'GET') continue;
      const trackerRelationship = method === 'POST'
        && /^repos\/[^/\s]+\/[^/\s]+\/issues\/\d+\/(?:sub_issues|dependencies\/blocked_by)$/.test(endpoint);
      if (!trackerRelationship) return `GitHub API ${method || 'mutation'}`;
      continue;
    }
    if (subcommand === 'auth' && action !== 'status') return `GitHub authentication ${action || 'change'}`;
    if (subcommand === 'alias' && action !== 'list') return `GitHub alias ${action || 'change'}`;
    if (subcommand === 'config' && !['get', 'list'].includes(action)) return `GitHub configuration ${action || 'change'}`;
    if (subcommand === 'pr' && action === 'merge') return 'GitHub pull request merge';
    if (subcommand === 'repo' && ['archive', 'edit', 'rename'].includes(action)) return `GitHub repository ${action}`;
    if (subcommand === 'repo' && action === 'sync' && hasFlag(args.slice(1), 'f', '--force')) return 'forced GitHub repository sync';
    if (subcommand === 'release' && ['create', 'edit', 'upload'].includes(action)) return `GitHub release ${action}`;
    if (subcommand === 'workflow' && ['disable', 'enable', 'run'].includes(action)) return `GitHub workflow ${action}`;
    if (subcommand === 'run' && ['cancel', 'rerun'].includes(action)) return `GitHub Actions run ${action}`;
    if (['secret', 'variable'].includes(subcommand) && action === 'set') return `GitHub ${subcommand} set`;
    if (['ssh-key', 'gpg-key'].includes(subcommand) && action === 'add') return `GitHub ${subcommand} add`;
    if (lower.includes('--force') && ['repo', 'pr', 'release', 'workflow', 'run'].includes(subcommand)) return `forced GitHub ${subcommand} operation`;
  }
  return null;
}

function exposesCredentialMaterial(command) {
  return /\bgh(?:\.exe)?\b[^\r\n;&|<>]*\bauth\s+token\b/i.test(command)
    || /(?:^|[\s;&|<>])(printenv|export\s+-p)(?=$|[\s;&|<>])/i.test(command)
    || /(?:^|[\s;&|<>])env\s*(?=$|[;&|<>])/i.test(command)
    || /\b(?:Get-ChildItem|gci|dir|ls)\s+Env:\s*(?=$|[;&|<>])/i.test(command)
    || /\bGet-Item\s+Env:\*\s*(?=$|[;&|<>])/i.test(command);
}

export function parseHookInput(raw) {
  let input;
  try {
    input = JSON.parse(raw || '{}');
  } catch {
    return { reason: 'The safety hook could not parse the tool request, so the operation is denied.' };
  }
  const toolInputValid = input?.tool_input && typeof input.tool_input === 'object' && !Array.isArray(input.tool_input);
  const argumentsValid = input?.arguments && typeof input.arguments === 'object' && !Array.isArray(input.arguments);
  if (!input || typeof input !== 'object' || (!toolInputValid && !argumentsValid)) {
    return { reason: 'The safety hook received an incomplete tool request, so the operation is denied.' };
  }
  return { input };
}

export function evaluateCommitBranch(branch) {
  if (!branch) return 'Commits from detached HEAD are blocked. Switch to a feature/<topic>, research/<topic>, or prototype/<topic> branch.';
  if (!/^(?:feature|research|prototype)\/[a-zA-Z0-9._/-]+$/.test(branch)) {
    return `Branch '${branch}' is not eligible for agent commits. Use feature/<topic>, research/<topic> for approved Wayfinder research, or prototype/<topic> for a throwaway prototype.`;
  }
  return null;
}

export function commandNeedsCurrentBranch(command) {
  return gitInvocations(command).some(({ subcommand }) => subcommand === 'push');
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
  if (exposesCredentialMaterial(command)) return 'Commands that print credential or environment material are blocked. Request only a specific non-secret value when needed.';

  const destructiveReason = destructiveGitReason(command);
  if (destructiveReason) return `${destructiveReason} is permanently blocked for agents because it can destroy user work.`;

  if (commandNeedsCurrentBranch(command)) {
    const allowed = command.match(/^git(?:\.exe)?\s+push\s+(?:(?:-u|--set-upstream)\s+)?origin\s+((?:feature|research|prototype)\/[a-zA-Z0-9._/-]+)$/i);
    if (!allowed) {
      return 'Push only the current feature, research, or prototype branch explicitly to origin. Force, deletion, tags, mirrors, alternate repositories, compound commands, and extra refspecs are blocked.';
    }
    if (!currentBranch || currentBranch.toLowerCase() !== allowed[1].toLowerCase()) {
      return `The pushed branch must be the current branch (${currentBranch || 'detached HEAD'}).`;
    }
  }
  const ghReason = destructiveGhReason(command);
  if (ghReason) return `${ghReason} is blocked because it deletes data, changes credentials or repository controls, publishes a release, runs automation, or bypasses reviewed collaboration.`;
  return null;
}
