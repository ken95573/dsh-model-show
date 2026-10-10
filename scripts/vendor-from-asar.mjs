#!/usr/bin/env node
/**
 * vendor-from-asar.mjs — regenerate `lib/client.js` from the DSH client bundle
 * that ships inside a local DeepSeek Harness install.
 *
 *   node scripts/vendor-from-asar.mjs                  # auto-detect the local install
 *   node scripts/vendor-from-asar.mjs --from <file>    # use an already extracted client.js
 *   node scripts/vendor-from-asar.mjs --asar <file>    # read it straight out of app.asar
 *   node scripts/vendor-from-asar.mjs --check          # exit 1 if lib/client.js is out of date
 *
 * Why vendor at all: DSH resolves the composer model seat
 * (`conversation.input.model`) through the client slot registry, and the
 * built-in seat lives inside `@deepseek-ai/dsh-client-ui-model-selection`,
 * which is bundled into `app.asar` and exports no reusable component. To show
 * `Provider/Model` in the trigger we therefore take that plugin's browser half
 * verbatim and change the seven documented spots below.
 *
 * If a future DSH release moves an anchor, this script fails loudly instead of
 * writing a half-patched bundle — re-run it after updating the anchors and the
 * whole plugin follows the new upstream build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const UPSTREAM_ID = '@deepseek-ai/dsh-client-ui-model-selection';
const UPSTREAM_ENTRY = `dsh/node_modules/${UPSTREAM_ID}/lib/client.js`;
const OUT = path.join(ROOT, 'lib', 'client.js');

/* ------------------------------------------------------------------ anchors */

/** Replace `from` with `to` exactly once; throw when the anchor is missing. */
function once(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`anchor not found (${label}) — upstream bundle changed?`);
  if (text.indexOf(from, first + 1) >= 0) throw new Error(`anchor is ambiguous (${label}) — refusing to patch`);
  return text.slice(0, first) + to + text.slice(first + from.length);
}

/**
 * The seven edits. Each entry documents what the upstream code did and why this
 * plugin changes it.
 */
const EDITS = [
  {
    label: '1. module id',
    why: 'the loader keys the module table by this id; it must equal our package name.',
    from: `\tid: "${UPSTREAM_ID}",`,
    to: `\tid: "${PKG.name}",`
  },
  {
    label: '2. locale namespace',
    why: 'the built-in plugin already registers the "model" dictionaries; registering the same namespace twice collides.',
    from: `\t\tconst NS = "model";`,
    to: `\t\tconst NS = "${PKG.name}";`
  },
  {
    label: '3. plugin services',
    why: 'we no longer own the catalog/resolver or the /model command, so only these three services are required.',
    from: `\t\t/** Required services: the contribution registry, the seat's slot registry, locale, and the service's own faces. */\n` +
          `\t\tconst inject = [\n\t\t\t"commandUi",\n\t\t\t"locale",\n\t\t\t"sessions",\n\t\t\t"slots",\n\t\t\t"remote",\n\t\t\t"remote.session"\n\t\t];`,
    to: `\t\t/** Required services: locale, the session registry, and the seat's slot registry. */\n` +
        `\t\tconst inject = [\n\t\t\t"locale",\n\t\t\t"sessions",\n\t\t\t"slots"\n\t\t];`
  },
  {
    label: '4. do not mount the catalog resolver',
    why: 'the built-in plugin owns the shared `modelDirectories` service; a second one would duplicate the catalog and its loader. The godoc above `apply` is rewritten in the same step so the vendored file does not describe a mount it no longer performs.',
    from: `\t\t/**\n` +
          `\t\t* Client plugin body: mount ModelDirectoryResolver, register the \`model\` dictionaries,\n` +
          `\t\t* then register the /model popup contribution and the composer model seat\n` +
          `\t\t* over the service.\n` +
          `\t\t* @param ctx - client root context.\n` +
          `\t\t*/\n` +
          `\t\tfunction apply(ctx) {\n` +
          `\t\t\tctx.effect(() => ctx.locale.register(NS, {\n` +
          `\t\t\t\tzh,\n` +
          `\t\t\t\ten\n` +
          `\t\t\t}), "ui-model-selection: dictionaries");\n` +
          `\t\t\tconst t = ctx.locale.bind(NS);\n` +
          `\t\t\tctx.plugin(ModelDirectoryResolver);`,
    to: `\t\t/**\n` +
        `\t\t* Client plugin body: register the \`model\` dictionaries, then register the\n` +
        `\t\t* composer model seat over the shared \`modelDirectories\` service.\n` +
        `\t\t* @param ctx - client root context.\n` +
        `\t\t*/\n` +
        `\t\tfunction apply(ctx) {\n` +
        `\t\t\tctx.effect(() => ctx.locale.register(NS, {\n` +
        `\t\t\t\tzh,\n` +
        `\t\t\t\ten\n` +
        `\t\t\t}), "ui-model-selection: dictionaries");\n` +
        `\t\t\tconst t = ctx.locale.bind(NS);\n` +
        `\t\t\t/*\n` +
        `\t\t\t* EDIT: upstream mounts ModelDirectoryResolver here, which owns the shared\n` +
        `\t\t\t* model catalog and the \`modelDirectories\` service. The built-in plugin keeps\n` +
        `\t\t\t* doing that (this plugin consumes the service), so it is not mounted twice.\n` +
        `\t\t\t*/`
  },
  {
    label: '5. drop the /model command contribution',
    why: 'the built-in plugin registers the same slash command; a second registration shows it twice in the palette.',
    regex: /\n\t\t\tctx\.inject\(\["commandUi", "modelDirectories"\], \(scope\) => \{[\s\S]*?\n\t\t\t\}\);/,
    to: `\n\t\t\t/*\n` +
        `\t\t\t* EDIT: upstream registers the \`/model\` slash command here. The built-in plugin\n` +
        `\t\t\t* already registers it, so this plugin only takes over the composer seat.\n` +
        `\t\t\t*/`
  },
  {
    label: '6. provider-prefixed trigger label',
    why: 'THE feature: the trigger renders `currentChoice.model.name`, so prefixing the choice copies makes the composer read "Provider/Model" while the menu (built from the untouched `groups`) keeps plain model names under their provider headings.',
    from: `\t\t\tconst choices = (0, react.useMemo)(() => groups.flatMap((group) => group.models.map((model) => ({\n` +
          `\t\t\t\tgroup,\n` +
          `\t\t\t\tmodel,\n` +
          `\t\t\t\tselection: {`,
    to: `\t\t\tconst choices = (0, react.useMemo)(() => groups.flatMap((group) => group.models.map((model) => ({\n` +
        `\t\t\t\tgroup,\n` +
        `\t\t\t\t/*\n` +
        `\t\t\t\t* EDIT: the trigger, its tooltip and its aria-label all render\n` +
        `\t\t\t\t* \`currentChoice.model.name\`. Prefixing the provider display name here gives\n` +
        `\t\t\t\t* "Provider/Model"; the menu reads \`filteredGroups[].models\` instead, so its\n` +
        `\t\t\t\t* rows keep the plain names under their provider headings.\n` +
        `\t\t\t\t*/\n` +
        `\t\t\t\tmodel: {\n` +
        `\t\t\t\t\t...model,\n` +
        `\t\t\t\t\tname: \`\${group.name}/\${model.name}\`\n` +
        `\t\t\t\t},\n` +
        `\t\t\t\tselection: {`
  },
  {
    label: '7. shadow the built-in seat',
    why: 'single slots render the lowest priority; -1 shadows the built-in registration at 0 (same priority would throw).',
    from: `"conversation.input.model",\n\t\t\t\t\tlocale: NS,`,
    to: `"conversation.input.model",\n` +
        `\t\t\t\t\t/* EDIT: the built-in seat registers at the default priority 0; the lowest\n` +
        `\t\t\t\t\t* priority renders, and an equal priority would collide. */\n` +
        `\t\t\t\t\tpriority: -1,\n` +
        `\t\t\t\t\tlocale: NS,`
  }
];

/** Apply every edit, returning the patched source. */
export function patch(source) {
  let text = source;
  for (const edit of EDITS) {
    if (edit.regex !== undefined) {
      const match = edit.regex.exec(text);
      if (match === null) throw new Error(`anchor not found (${edit.label}) — upstream bundle changed?`);
      text = text.slice(0, match.index) + edit.to + text.slice(match.index + match[0].length);
    } else {
      text = once(text, edit.from, edit.to, edit.label);
    }
  }
  verify(text);
  return text;
}

/** Post-conditions: the produced bundle must actually carry every edit. */
export function verify(text) {
  const checks = [
    [text.includes(`id: "${PKG.name}",`), 'module id'],
    [text.includes(`const NS = "${PKG.name}";`), 'locale namespace'],
    [!text.includes('\t\t\tctx.plugin(ModelDirectoryResolver);'), 'resolver not mounted'],
    [!text.includes('mount ModelDirectoryResolver, register'), 'stale plugin godoc rewritten'],
    [!text.includes('"commandUi", "modelDirectories"'), '/model command not registered'],
    [text.includes('name: `${group.name}/${model.name}`'), 'provider-prefixed label'],
    [text.includes('priority: -1,'), 'seat priority'],
    [text.includes('currentChoice?.model.name'), 'trigger still reads currentChoice.model.name'],
    [text.includes('require("@deepseek-ai/dsh-client-ui-primitives")'), 'primitives require kept'],
    [text.includes('require("@deepseek-ai/cordis")'), 'cordis require kept'],
    [text.includes('require("@deepseek-ai/dsh-client-store")'), 'client-store require kept'],
    [text.includes('//# sourceMappingURL=client.js.map'), 'source map comment kept']
  ];
  const failed = checks.filter(([ok]) => !ok).map(([, name]) => name);
  if (failed.length > 0) throw new Error(`produced bundle failed verification: ${failed.join(', ')}`);
}

/* ----------------------------------------------------------- input sources */

/**
 * Read one entry out of an asar archive without external dependencies.
 *
 * An asar archive is two nested pickles followed by the concatenated entries:
 *
 *   [0 .. 8)              pickle header: uint32 payloadSize (= 4), uint32 headerSize
 *   [8 .. 8+headerSize)   the header pickle: uint32 jsonLen, then the UTF-8 JSON tree
 *   [8+headerSize ..)     entry contents; `node.offset` is relative to that point
 *
 * Reading `jsonLen` from the header pickle's offset 0 instead of offset 4 is an
 * off-by-four that makes every real archive look like it has a corrupt header.
 */
export function readAsarEntry(archive, entryPath) {
  const fd = fs.openSync(archive, 'r');
  try {
    const sizeHead = Buffer.alloc(8);
    if (fs.readSync(fd, sizeHead, 0, 8, 0) !== 8) {
      throw new Error(`${archive}: not an asar archive (shorter than 8 bytes)`);
    }
    const headerSize = sizeHead.readUInt32LE(4);
    const dataStart = 8 + headerSize;
    if (headerSize < 8 || headerSize > 64 * 1024 * 1024) {
      throw new Error(`${archive}: not an asar archive (implausible header size ${headerSize})`);
    }
    const head = Buffer.alloc(headerSize);
    if (fs.readSync(fd, head, 0, headerSize, 8) !== headerSize) {
      throw new Error(`${archive}: truncated asar header (expected ${headerSize} bytes)`);
    }
    const json = parseAsarHeader(archive, head, headerSize);
    let node = json;
    for (const part of entryPath.split('/')) {
      node = node?.files?.[part];
      if (node === undefined) throw new Error(`${archive}: no entry ${entryPath}`);
    }
    if (typeof node.offset !== 'string') throw new Error(`${archive}: ${entryPath} is a directory`);
    const size = toInt(node.size);
    const at = toInt(node.offset);
    if (size === undefined || at === undefined || at < 0) {
      throw new Error(`${archive}: ${entryPath} has an invalid size/offset`);
    }
    const out = Buffer.alloc(size);
    if (fs.readSync(fd, out, 0, size, dataStart + at) !== size) {
      throw new Error(`${archive}: truncated entry ${entryPath}`);
    }
    return out.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

/** `node.size` is a number and `node.offset` a decimal string; accept either. */
function toInt(value) {
  const n = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isSafeInteger(n) ? n : undefined;
}

/**
 * Decode the JSON tree out of the header pickle. A pickled string is
 * `[uint32 length][bytes]`, so inside the header pickle the length sits at
 * offset 4 and the JSON at offset 8. A bare `[length][bytes]` header is also
 * tolerated; the first candidate yielding a tree with `files` wins.
 */
function parseAsarHeader(archive, head, headerSize) {
  const tried = [];
  for (const start of [8, 4]) {
    const length = head.readUInt32LE(start - 4);
    tried.push(`offset ${start} needs ${length}`);
    if (length < 2 || start + length > headerSize) continue;
    try {
      const json = JSON.parse(head.subarray(start, start + length).toString('utf8'));
      if (json !== null && typeof json === 'object' && json.files !== undefined) return json;
    } catch {
      /* not this layout — try the next one */
    }
  }
  throw new Error(`${archive}: unreadable asar header (headerSize=${headerSize}; ${tried.join('; ')})`);
}

/** Best-effort localisation of the shipping app.asar. */
function detectAsar() {
  const candidates = [];
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    if (local) candidates.push(path.join(local, 'Programs', 'DeepSeek Harness', 'resources', 'app.asar'));
  }
  if (process.platform === 'darwin') {
    candidates.push('/Applications/DeepSeek Harness.app/Contents/Resources/app.asar');
  }
  candidates.push('/opt/DeepSeek Harness/resources/app.asar');
  return candidates.find((c) => fs.existsSync(c));
}

/* ---------------------------------------------------------------------- cli */

function main(argv) {
  const args = argv.slice(2);
  const read = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const checkOnly = args.includes('--check');

  let source;
  let origin;
  const fromFile = read('--from');
  const fromAsar = read('--asar');
  if (fromFile !== undefined) {
    source = fs.readFileSync(fromFile, 'utf8');
    origin = fromFile;
  } else if (fromAsar !== undefined) {
    source = readAsarEntry(fromAsar, UPSTREAM_ENTRY);
    origin = `${fromAsar}!${UPSTREAM_ENTRY}`;
  } else {
    const asar = detectAsar();
    if (asar === undefined) {
      throw new Error('no local DeepSeek Harness install found — pass --from <client.js> or --asar <app.asar>');
    }
    source = readAsarEntry(asar, UPSTREAM_ENTRY);
    origin = `${asar}!${UPSTREAM_ENTRY}`;
  }

  const patched = patch(source);
  console.log(`upstream : ${origin} (${Buffer.byteLength(source)} bytes)`);
  console.log(`edits    : ${EDITS.length}`);
  console.log(`output   : lib/client.js (${Buffer.byteLength(patched)} bytes)`);

  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : undefined;
  if (checkOnly) {
    if (current !== patched) {
      console.error('lib/client.js is OUT OF DATE — run: node scripts/vendor-from-asar.mjs');
      process.exitCode = 1;
    } else {
      console.log('lib/client.js is up to date');
    }
    return;
  }
  if (current === patched) {
    console.log('no change — lib/client.js already matches this upstream bundle');
    return;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, patched);
  console.log('wrote lib/client.js');
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(`vendor-from-asar: ${error.message}`);
    process.exitCode = 1;
  }
}
