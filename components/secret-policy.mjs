const credentialFileNames = ['.netrc', '.git-credentials', '.pypirc'];
const credentialFileNameSet = new Set(credentialFileNames);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const credentialFilePattern = new RegExp(
  `(?:^|/)(?:${credentialFileNames.map(escapeRegex).join('|')})(?=$|[\\s"';&|<>()])`,
  'i',
);

const sharedClaudeDenials = [
  'Read(**/.env)',
  'Read(**/.env.local)',
  'Read(**/.env.*.local)',
  'Read(**/*.pem)',
  'Read(**/*.key)',
  'Read(**/id_rsa*)',
  'Read(**/id_ed25519*)',
  ...credentialFileNames.map((name) => `Read(**/${name})`),
];

const machineClaudeDenials = [
  'Read(~/.ssh/**)',
  'Read(~/.aws/**)',
  'Read(~/.azure/**)',
];

const projectClaudeDenials = [
  'Read(./.env)',
  'Read(./.env.local)',
  'Read(./.env.*.local)',
];

export function claudeSecretDenials(scope) {
  if (scope === 'machine') return [...sharedClaudeDenials, ...machineClaudeDenials];
  if (scope === 'project') return [...projectClaudeDenials, ...sharedClaudeDenials];
  throw new Error('Secret denial scope must be machine or project');
}

export function containsSensitivePath(value) {
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
    || credentialFilePattern.test(normalized)
    || /(?:^|[\/\s"'])(?:service[-_.]?account(?:[-_.]key)?|application_default_credentials)\.json(?=$|[\s"';&|<>()])/i.test(normalized);
}

export function isSecretBearingCommitPath(filePath) {
  const name = filePath.replaceAll('\\', '/').split('/').at(-1).toLowerCase();
  if (['.env.example', '.env.sample', '.env.template'].includes(name)) return false;
  return name === '.env' || name.startsWith('.env.')
    || credentialFileNameSet.has(name)
    || /^(?:id_rsa|id_ed25519)/i.test(name)
    || /\.(?:pem|key|p12|pfx)$/i.test(name);
}
