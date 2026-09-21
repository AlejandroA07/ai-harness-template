import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deniedClaudeBuiltInTools } from '../components/claude-tool-policy.mjs';
import { loadCatalog } from './catalog-loader.mjs';
import { loadIntegrationCatalog } from './integration-catalog.mjs';
import { buildCostInventory, renderCostMarkdown } from './cost-inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inventory = await buildCostInventory(root, await loadCatalog(root), await loadIntegrationCatalog(root));
const markdown = renderCostMarkdown(inventory, deniedClaudeBuiltInTools);

if (process.argv.includes('--write')) {
  await fs.writeFile(path.join(root, 'TOKEN-COSTS.md'), markdown);
  console.log(`Wrote ${path.join(root, 'TOKEN-COSTS.md')}`);
} else {
  process.stdout.write(markdown);
}
