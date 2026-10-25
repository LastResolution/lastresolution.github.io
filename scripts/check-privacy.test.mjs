import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./check-privacy.ps1', import.meta.url));
function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'lastresolution-privacy-'));
  try {
    await mkdir(path.join(root, 'scripts'));
    await copyFile(script, path.join(root, 'scripts/check-privacy.ps1'));
    await writeFile(path.join(root, '.nojekyll'), '');
    await writeFile(path.join(root, 'README.md'), 'A public website.');
    git(root, 'init', '--quiet');
    git(root, 'config', 'user.name', 'Fixture');
    git(root, 'config', 'user.email', 'fixture@users.noreply.github.com');
    git(root, 'add', '.nojekyll', 'README.md');
    await run(root);
  } finally {
    const expected = path.resolve(tmpdir()) + path.sep;
    assert.ok(path.resolve(root).startsWith(expected));
    assert.ok(path.basename(root).startsWith('lastresolution-privacy-'));
    await rm(root, { recursive: true, force: true });
  }
}
function scan(root, ...args) {
  return spawnSync('pwsh', ['-NoProfile', '-File', path.join(root, 'scripts/check-privacy.ps1'), ...args], {
    cwd: root, encoding: 'utf8'
  });
}
test('privacy scanning accepts tracked empty files', () => fixture(async root => {
  const result = scan(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /checked in 2 files/);
}));
test('privacy scanning accepts staged empty files', () => fixture(async root => {
  const result = scan(root, '-Staged');
  assert.equal(result.status, 0, result.stderr);
}));
test('a staged credential fails without revealing its value', () => fixture(async root => {
  const credential = 'ghp_' + 'A'.repeat(36);
  await writeFile(path.join(root, 'README.md'), credential);
  git(root, 'add', 'README.md');
  const result = scan(root, '-Staged');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /GitHub token/);
  assert.ok(!(result.stdout + result.stderr).includes(credential));
}));
