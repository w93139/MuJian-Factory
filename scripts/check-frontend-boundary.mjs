import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.join(root, 'frontend');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? files(file) : entry.isFile() ? [file] : [];
  });
}
// The archived design remains independently runnable. Production must not
// accidentally regain its fake account, localStorage state or unused variants.
for (const dir of ['app', 'components', 'live', 'lib', 'ui']) {
  for (const file of files(path.join(frontend, dir))) {
    if (!/\.(tsx?|css|mjs)$/.test(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    assert(!/(?:@\/concepts\/|["'](?:\.\.\/)+concepts\/)/.test(source), `Production imports archived concepts: ${file}`);
  }
}
const chunks = files(path.join(frontend, '.next/static')).filter(file => /\.(js|css)$/.test(file));
assert(chunks.length, 'Build the production frontend before checking its boundary');
for (const file of chunks) {
  const source = fs.readFileSync(file, 'utf8');
  for (const marker of ['mujian-concept-v1-', 'demo-orbit', 'MUJIANDEMO', '.v3.guided', '.v3.gallery']) {
    assert(!source.includes(marker), `Archived demo marker ${marker} shipped in ${file}`);
  }
}
console.log(`Production boundary passed: ${chunks.length} JS/CSS assets, no archived demo state or unselected variants.`);
