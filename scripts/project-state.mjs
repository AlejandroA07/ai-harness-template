const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const block = '# Selected project harness\n.scratch/\n.harness/.project-stage-*/\n.ai-harness-install.lock/\n.claude/settings.local.json\n.harness/tmp/\n.env\n.env.*\n!.env.example\n!.env.sample\n!.env.template\n*.pem\n*.key\n*.p12\n*.pfx\n# End selected project harness\n';
export function projectIgnore(bytes, prior, remove = false) {
  const text = bytes?.toString('utf8') ?? '';
  if (prior && (!object(prior) || Object.keys(prior).sort().join(',') !== 'existed,owned,separator'
    || Object.values(prior).some((value) => typeof value !== 'boolean'))) throw new Error('Invalid ignore ownership');
  const state = prior ?? { existed: bytes !== null, owned: !text.includes(block), separator: Boolean(text && !text.endsWith('\n')) };
  const ownedText = (state.separator ? '\n' : '') + block;
  if (prior && (!text.includes(state.owned ? ownedText : block) || text.indexOf(block) !== text.lastIndexOf(block))) throw new Error('Owned ignore block was edited');
  if (!prior && text.includes('# Selected project harness') && (!text.includes(block) || text.indexOf(block) !== text.lastIndexOf(block))) throw new Error('Legacy or duplicate ignore block requires review');
  let afterText = prior || !state.owned ? text : text + ownedText;
  if (remove && state.owned) {
    const index = text.indexOf(ownedText);
    const suffix = text.slice(index + ownedText.length);
    afterText = text.slice(0, index) + (state.separator && suffix ? '\n' : '') + suffix;
  }
  return { state, after: remove && !state.existed && !afterText ? null : Buffer.from(afterText) };
}
