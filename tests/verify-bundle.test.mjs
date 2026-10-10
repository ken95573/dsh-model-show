/**
 * Offline verification for the shipped browser bundle.
 *
 * These tests never touch a DSH install: they read the committed
 * `lib/client.js`, check that all six vendoring edits are present, and then
 * *evaluate the shipped expressions* — the very bytes that run in the browser —
 * to prove the trigger label reads "Provider/Model" while the menu rows keep
 * their plain model names.
 *
 * Run with: npm test
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { patch, verify } from '../scripts/vendor-from-asar.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const BUNDLE = fs.readFileSync(path.join(ROOT, 'lib', 'client.js'), 'utf8');
const BUNDLE_LINES = BUNDLE.split('\n');

/* ------------------------------------------------------------------ helpers */

/** Slice the shipped statement that starts at `start` and ends at `end`. */
function statement(start, end) {
  const from = BUNDLE.indexOf(start);
  assert.notEqual(from, -1, `statement not found: ${start}`);
  const to = BUNDLE.indexOf(end, from);
  assert.notEqual(to, -1, `statement end not found: ${end}`);
  return BUNDLE.slice(from, to + end.length);
}

/** Slice the single shipped line containing `needle`. */
function line(needle) {
  const found = BUNDLE_LINES.filter((l) => l.includes(needle));
  assert.equal(found.length, 1, `expected exactly one line containing ${needle}, found ${found.length}`);
  return found[0];
}

const stubPrimitives = {
  rankByName: (models, query) =>
    query === '' ? models : models.filter((model) => model.name.toLowerCase().includes(query.toLowerCase()))
};

/** Evaluate the shipped `choices` memo exactly as the browser would. */
function choicesOf(groups) {
  const src = statement('const choices = (0, react.useMemo)(', '}))), [groups]);');
  const react = { useMemo: (factory) => factory() };
  return new Function('react', 'groups', `${src}\nreturn choices;`)(react, groups);
}

/** Evaluate the shipped `filteredGroups` memo (the menu rows). */
function menuGroupsOf(groups, query = '') {
  const src = statement('const filteredGroups = (0, react.useMemo)(', '\n\t\t\t]);');
  const react = { useMemo: (factory) => factory() };
  const primitives = stubPrimitives;
  const showSearch = choicesOf(groups).length > 4;
  return new Function(
    'react',
    'groups',
    'query',
    'showSearch',
    '_deepseek_ai_dsh_client_ui_primitives',
    `${src}\nreturn filteredGroups;`
  )(react, groups, query, showSearch, primitives);
}

/** Evaluate the shipped trigger-label expressions. */
function triggerLabelOf({ current, status, retainedEffort, groups }) {
  const choices = choicesOf(groups);
  const currentChoice =
    choices[current === null ? -1 : choices.findIndex((c) => c.selection.provider === current?.provider && c.selection.model === current.model)];
  const reasoning = currentChoice?.model.reasoning;
  const effectiveEffort = current?.reasoningEffort ?? reasoning?.defaultEffort;
  const effortLabel =
    reasoning === void 0
      ? retainedEffort
      : effectiveEffort === void 0
        ? t('effort.providerDefault')
        : reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort;
  // The shipped trigger label is three consecutive statements; evaluate all three
  // so the test runs the plugin's own bytes rather than a re-implementation.
  const src = [
    line('const waiting = '),
    line('const modelLabel = '),
    line('const triggerLabel = '),
    'return triggerLabel;'
  ].join('\n');
  return new Function('t', 'currentChoice', 'state', 'effortLabel', src)(t, currentChoice, { current, status }, effortLabel);
}

/** The shipped dictionary keys this test relies on, stubbed with the real zh strings. */
const t = (key) => ({ 'trigger.loading': '加载中', 'trigger.fallback': '选择模型', 'effort.providerDefault': '默认' })[key] ?? key;

/* ------------------------------------------------------------------- fixtures */

const PROVIDER_A = {
  id: 'example-provider',
  name: 'Example Provider',
  models: [
    {
      id: 'example-chat',
      name: 'Example Chat',
      reasoning: { defaultEffort: 'high', efforts: [{ id: 'high', name: 'High' }, { id: 'max', name: 'Max' }] }
    },
    { id: 'example-lite', name: 'Example Lite' }
  ]
};
const PROVIDER_B = {
  id: 'example-vendor',
  name: 'Example Vendor',
  models: [{ id: 'example-pro', name: 'Example Pro' }]
};
const GROUPS = [PROVIDER_A, PROVIDER_B];
/** Six models across three providers: enough for the built-in "show search" threshold (>4). */
const BIG = [
  PROVIDER_A,
  PROVIDER_B,
  {
    id: 'extra',
    name: 'Extra Provider',
    models: [
      { id: 'e1', name: 'Echo One' },
      { id: 'e2', name: 'Echo Two' },
      { id: 'e3', name: 'Echo Three' }
    ]
  }
];

/* --------------------------------------------------------------- packaging */

test('package.json describes a loadable dsh client plugin', () => {
  assert.equal(PKG.type, 'module');
  assert.equal(PKG.dsh.client.platform, 'web');
  assert.ok(Array.isArray(PKG.dsh.client.inject));
  assert.equal(PKG.dsh.bundle.patch, './cordis.patch.yml');
  assert.ok(fs.existsSync(path.join(ROOT, PKG.dsh.bundle.patch)), 'bundle patch file exists');
  assert.equal(PKG.exports['./client'], './lib/client.js');
  assert.ok(fs.existsSync(path.join(ROOT, PKG.main)), 'host half exists');
  assert.ok(fs.existsSync(path.join(ROOT, 'lib', 'client.js')), 'client bundle exists');
});

test('plugin manager metadata is complete', () => {
  assert.equal(PKG.icon, './icon.svg');
  assert.ok(PKG.files.includes('locale') && PKG.files.includes('icon.svg'), 'files ships the card assets');
  assert.equal(PKG.exports['./locale/*.json'], './locale/*.json');
  const icon = fs.readFileSync(path.join(ROOT, 'icon.svg'), 'utf8');
  assert.ok(Buffer.byteLength(icon) <= 256 * 1024, 'icon stays under the 256 KiB limit');
  assert.match(icon, /<svg[^>]*viewBox="0 0 48 48"/);
  assert.match(icon, /<\/svg>\s*$/);
  for (const [lang, expected] of [
    ['en', 'Provider/Model label'],
    ['zh', '供应商/模型 标签']
  ]) {
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'locale', `${lang}.json`), 'utf8'));
    assert.equal(meta.meta.title, expected);
    assert.ok(meta.meta.description.length > 10, `${lang} description is usable`);
  }
  for (const doc of ['LICENSE', 'NOTICE.md', 'README.md', 'README.zh-CN.md']) {
    assert.ok(fs.existsSync(path.join(ROOT, doc)), `${doc} exists`);
  }
  assert.match(fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8'), /^MIT License/);
});

test('client declaration matches the vendored bundle', () => {
  assert.equal(PKG.dsh.client.immediately, true);
  assert.equal(PKG.dsh.client.platform, 'web');
  assert.ok(
    PKG.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-model-selection'),
    'the built-in plugin provides the modelDirectories service this plugin consumes'
  );
  for (const spec of ['@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store']) {
    assert.ok(PKG.dsh.client.external.includes(spec), `external declares ${spec}`);
  }
});

test('cordis patch inserts the entry under the package name', () => {
  const yml = fs.readFileSync(path.join(ROOT, 'cordis.patch.yml'), 'utf8');
  assert.match(yml, /- insert:/);
  assert.match(yml, new RegExp(`name: '${PKG.name}'`));
  assert.match(yml, new RegExp(`id: ${PKG.name.replace(/^dsh-/, '')}`));
});

test('host half is a no-op apply', async () => {
  const host = await import(pathToFileURL(path.join(ROOT, PKG.main)).href);
  assert.equal(typeof host.apply, 'function');
  assert.equal(host.apply(), undefined);
});

/* ------------------------------------------------------------- bundle edits */

test('bundle carries all six vendoring edits', () => {
  assert.equal(BUNDLE_LINES[0], 'window.__ModuleLoader__.load({');
  assert.equal(line(`id: "${PKG.name}",`).trim(), `id: "${PKG.name}",`);
  assert.equal(line('const NS = ').trim(), `const NS = "${PKG.name}";`);
  /*
   * The upstream service list must survive vendoring: the seat's per-session
   * catalog is resolved through the consuming context (`remote.session`), and a
   * context that does not declare it throws on the first render after a real
   * launch — the slot registry silently retires the entry and the built-in seat
   * renders instead, so the Provider/Model prefix only showed up after a rebuild.
   */
  assert.match(BUNDLE, /\t\t\t"remote",\n\t\t\t"remote\.session"\n/);
  assert.doesNotMatch(BUNDLE, /ctx\.plugin\(ModelDirectoryResolver\);/, 'resolver must not be mounted');
  assert.doesNotMatch(BUNDLE, /"commandUi", "modelDirectories"/, '/model command must not be registered');
  assert.match(BUNDLE, /priority: -1,/);
  assert.match(BUNDLE, /name: `\$\{group\.name\}\/\$\{model\.name\}`/);
  assert.equal(line('const modelLabel = ').includes('currentChoice?.model.name'), true);
});

test('required upstream modules are still required (platform seeds)', () => {
  for (const spec of [
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-store',
    'react/jsx-runtime',
    'react',
    'react-dom'
  ]) {
    assert.match(BUNDLE, new RegExp(`require\\("${spec.replace(/[/.]/g, '\\$&')}"\\)`), `requires ${spec}`);
  }
  assert.match(BUNDLE, /^\/\/# sourceMappingURL=client\.js\.map$/m);
});

test('verify() accepts the committed bundle and rejects a stale one', () => {
  assert.doesNotThrow(() => verify(BUNDLE));
  assert.throws(() => verify(BUNDLE.replace('priority: -1,', 'priority: 0,')), /failed verification: seat priority/);
});

test('patch() fails loudly when upstream anchors move', () => {
  assert.throws(() => patch('window.__ModuleLoader__.load({ id: "x", factory: () => {} });'), /anchor not found/);
});

/* ------------------------------------------------------------ label behaviour */

test('trigger shows Provider/Model with the effort suffix', () => {
  assert.equal(
    triggerLabelOf({
      current: { provider: 'example-provider', model: 'example-chat', reasoningEffort: 'high' },
      status: 'ready',
      retainedEffort: undefined,
      groups: GROUPS
    }),
    'Example Provider/Example Chat · High'
  );
});

test('trigger uses each provider display name', () => {
  assert.equal(
    triggerLabelOf({
      current: { provider: 'example-vendor', model: 'example-pro' },
      status: 'ready',
      retainedEffort: undefined,
      groups: GROUPS
    }),
    'Example Vendor/Example Pro'
  );
});

test('loading / empty / unknown-selection fallbacks are unchanged', () => {
  assert.equal(
    triggerLabelOf({ current: null, status: 'loading', retainedEffort: undefined, groups: [] }),
    '加载中'
  );
  assert.equal(triggerLabelOf({ current: null, status: 'ready', retainedEffort: undefined, groups: GROUPS }), '选择模型');
  assert.equal(
    triggerLabelOf({
      current: { provider: 'ghost', model: 'x' },
      status: 'ready',
      retainedEffort: undefined,
      groups: GROUPS
    }),
    'ghost/x'
  );
});

test('menu rows stay plain and keep their provider headings', () => {
  const menu = menuGroupsOf(GROUPS);
  assert.deepEqual(
    menu.map((group) => [group.name, group.models.map((model) => model.name)]),
    [
      ['Example Provider', ['Example Chat', 'Example Lite']],
      ['Example Vendor', ['Example Pro']]
    ]
  );
});

test('menu search matches the plain (unprefixed) model names', () => {
  assert.equal(choicesOf(BIG).length > 4, true, 'fixture must cross the search threshold');
  assert.deepEqual(
    menuGroupsOf(BIG, 'example').map((group) => group.models.map((model) => model.name)),
    [['Example Chat', 'Example Lite'], ['Example Pro']]
  );
  assert.deepEqual(
    menuGroupsOf(BIG, 'chat').map((group) => group.models.map((model) => model.name)),
    [['Example Chat']]
  );
  assert.deepEqual(menuGroupsOf(BIG, 'Example Provider'), [], 'provider names never leak into model-name search');
});

test('choices still drive the search threshold and keep selection intact', () => {
  const choices = choicesOf(GROUPS);
  assert.equal(choices.length, 3);
  assert.deepEqual(choices[0].selection, {
    provider: 'example-provider',
    model: 'example-chat',
    reasoningEffort: 'high'
  });
  assert.deepEqual(choices[1].selection, { provider: 'example-provider', model: 'example-lite' });
  assert.equal(choices[1].group, PROVIDER_A, 'the untouched provider group is still reachable');
  const withDefault = choicesOf([
    { id: 'p', name: 'P', models: [{ id: 'm', name: 'M', reasoning: { defaultEffort: 'low', efforts: [] } }] }
  ]);
  assert.equal(withDefault[0].selection.reasoningEffort, 'low');
  assert.equal(withDefault[0].model.name, 'P/M');
});
