import { object, inspectFeatures, editFeatures } from './global-settings.mjs';

// Compatibility only: remove project-level Codex feature ownership recorded by
// receipts created before universal agent policy moved to machine scope.
export function removeLegacyProjectFeatures(bytes, prior) {
  const text = bytes?.toString('utf8') ?? '';
  const parsed = inspectFeatures(text);
  if (!object(prior) || Object.keys(prior).sort().join(',') !== 'createdTable,existed,values'
    || typeof prior.createdTable !== 'boolean' || typeof prior.existed !== 'boolean' || !object(prior.values)
    || Object.keys(prior.values).sort().join(',') !== 'hooks'
    || Object.values(prior.values).some((value) => value !== null && typeof value !== 'boolean')) throw new Error('Invalid project feature ownership');
  if (parsed.values.hooks !== true) throw new Error('Owned project features were edited');
  const afterText = editFeatures(text, prior.values, prior.createdTable);
  return prior.existed || afterText.trim() ? Buffer.from(afterText) : null;
}
