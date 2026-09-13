import { isDeepStrictEqual as equal } from 'node:util';
import { object, inspectFeatures, editFeatures } from './global-settings.mjs';

const block = '# Selected project harness\n.scratch/\n.harness/.project-stage-*/\n.ai-harness-install.lock/\n# End selected project harness\n';
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
export function projectFeatures(bytes, prior, remove = false) {
  const text = bytes?.toString('utf8') ?? '';
  const parsed = inspectFeatures(text);
  if (prior && (!object(prior) || Object.keys(prior).sort().join(',') !== 'createdTable,existed,values'
    || typeof prior.createdTable !== 'boolean' || typeof prior.existed !== 'boolean' || !object(prior.values)
    || Object.keys(prior.values).sort().join(',') !== 'hooks,memories'
    || Object.values(prior.values).some((value) => value !== null && typeof value !== 'boolean'))) throw new Error('Invalid project feature ownership');
  if (prior && !equal(parsed.values, { hooks: true, memories: false })) throw new Error('Owned project features were edited');
  const state = prior ?? { existed: bytes !== null, createdTable: parsed.featureHeader === null, values: parsed.values };
  const afterText = editFeatures(text, remove ? state.values : { hooks: true, memories: false }, remove && state.createdTable);
  return { state, after: remove && !state.existed && !afterText.trim() ? null : Buffer.from(afterText) };
}
