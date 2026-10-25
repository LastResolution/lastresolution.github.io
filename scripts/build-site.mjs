import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicFiles, verifySite } from './verify-site.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await verifySite(root);
const output = path.join(root, 'dist');
await mkdir(output, { recursive:true });
for (const file of publicFiles) {
  await mkdir(path.dirname(path.join(output, file)), { recursive:true });
  await copyFile(path.join(root, file), path.join(output, file));
}
const result = await verifySite(output, { distribution:true });
console.log(`Built ${result.files} public files; ${result.checks} checks passed.`);
