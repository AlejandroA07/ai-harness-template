import { checkProject } from '../.harness/project-runtime/project-check.mjs';
import { runTool } from '../.harness/runtime/windows-cli.mjs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
await checkProject(root);
const result = runTool(process.execPath, ['scripts/verify.mjs'], { cwd: root, stdio: 'inherit', shell: false });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
