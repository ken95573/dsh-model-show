/*
 * What may ship to npm, and what may not.
 *
 * `files` used to list the bare `docs` directory, so any note dropped in there
 * was published by accident — an internal write-up reached the registry once.
 * The manifest now enumerates documentation paths, and this test keeps it that
 * way: a whitelisted directory may only be one we generate into (code), and
 * every file under a documented directory must be named explicitly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const files = manifest.files ?? [];

/** Directories whose whole content is code we generate: safe to publish as-is. */
const GENERATED_DIRS = new Set(['lib', 'locale']);

test('a whitelisted directory is either generated code or fully enumerated', () => {
  const dirs = files.filter((entry) => {
    try {
      return statSync(join(ROOT, entry)).isDirectory();
    } catch {
      return false;
    }
  });
  const bare = dirs.filter((entry) => !GENERATED_DIRS.has(entry));
  assert.deepEqual(bare, [], 'no bare directory may be published: list its files instead');
  assert.ok(dirs.every((entry) => GENERATED_DIRS.has(entry)), 'only generated code directories are whitelisted wholesale');
});

test('every file under docs/ is published by name, not by directory', () => {
  const docsDir = join(ROOT, 'docs');
  if (!existsSync(docsDir)) return;
  const entries = readdirSync(docsDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => `docs/${d.name}`);
  assert.ok(entries.length > 0, 'docs/ is expected to hold the screenshot');
  for (const entry of entries) {
    assert.ok(files.includes(entry), `${entry} must be listed in package.json files`);
  }
});

test('internal notes never ship', () => {
  const notesDir = join(ROOT, 'notes');
  const shippedNotes = files.filter((entry) => entry.startsWith('notes'));
  assert.deepEqual(shippedNotes, [], 'notes/ holds internal write-ups and must stay out of the package');
  if (existsSync(notesDir)) {
    for (const dirent of readdirSync(notesDir, { withFileTypes: true })) {
      assert.ok(!files.some((entry) => entry.includes(dirent.name)), `${dirent.name} must not be published`);
    }
  }
});

test('the published set is the twelve expected files', () => {
  assert.deepEqual(files, [
    'lib',
    'locale',
    'docs/composer-trigger.png',
    'icon.svg',
    'cordis.patch.yml',
    'LICENSE',
    'NOTICE.md',
    'README.md',
    'README.zh-CN.md'
  ]);
});
