# dsh-model-show

A [DSH](https://github.com/deepseek-ai) client plugin for the Web UI: the composer's model
selector shows **Provider/Model** instead of a bare model name, so a selected model always names
the provider it comes from.

| | Composer trigger |
|---|---|
| Before | `Example Chat · High` |
| After  | `Example Provider/Example Chat · High` |

The dropdown menu is untouched: rows stay plain (`Example Chat`) under their provider
headings, and search keeps matching plain model names. The hover tooltip and ARIA label carry the
same `Provider/Model` text as the visible trigger.

## Requirements

- DSH `>= 0.2.0-rc.1 < 0.3.0-0`, `web` client platform (developed and tested against the Desktop
  runtime `0.2.0-rc.2`).
- The built-in model selection plugin (`@deepseek-ai/dsh-client-ui-model-selection`) must stay
  enabled. This plugin reuses its `modelDirectories` service and only shadows the composer seat.
- Provider names are whatever your own model configuration declares (`displayName` of each
  provider row), e.g. `Example Provider`, `Example Vendor`.

## Install

### Plugin market

Open the plugin market in the target DSH app, search for the package name `dsh-model-show`,
install it, then enable it.

### Desktop CLI

The Desktop app ships its own CLI (the reserved `desktop` profile is managed only by it):

```console
"%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add dsh-model-show
```

From GitHub, or from a local checkout:

```console
"%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add github:<user>/dsh-model-show
"%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "C:\path\to\dsh-model-show"
```

Remove it with `plugin --profile desktop remove dsh-model-show`.

### From a DSH session

Ask the agent to install the bundle from this directory (`plugin_manager` with
`action: install_bundle` and the package directory as `target`).

Reload the page after installing. Replacing an already-loaded plugin with a different build needs
an application restart.

## Verify

1. The composer trigger reads `Provider/Model` (plus `· <effort>` when the model reports a
   reasoning effort).
2. Hovering it shows the same text.
3. The menu still lists plain model names under provider headings, and searching a provider name
   does not match models.

## How it works

- `lib/index.js` is the plugin's (empty) node half, so the bundle can be mounted by the profile's
  layer stack; the browser half is discovered through `dsh.client` + `exports["./client"]`.
- `cordis.patch.yml` inserts one row (`id: model-show`, `name: dsh-model-show`).
- `lib/client.js` is the built-in `@deepseek-ai/dsh-client-ui-model-selection` browser bundle with
  six documented edits (`scripts/vendor-from-asar.mjs`, each marked with an `EDIT:` comment in
  the generated file). The two that produce the visible change are the provider-prefixed
  `choices[].model.name` and registering the composer seat at `priority: -1`, which shadows the
  built-in seat because the lowest priority renders. The upstream `inject` list is left untouched
  (see Limitations — the seat resolves its catalog through the consuming context).
- The label is prefixed where the trigger reads it (`currentChoice?.model.name`), so the menu's own
  `groups` — and therefore search — stay untouched.

## Development

```console
npm test                 # offline checks: manifest, the six edits, and the label behaviour
npm run vendor           # re-extract the upstream bundle from the installed app and re-apply the edits
npm run vendor:check     # exit non-zero when the shipped bundle is not the vendored one
```

`npm run vendor` reads
`%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\app.asar` →
`dsh/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js`, or a client bundle
passed with `--from <client.js>` / an archive with `--asar <app.asar>`.

If upstream moves an anchor, vendoring fails loudly (`anchor not found (<label>) — upstream
bundle changed?`) instead of shipping a broken bundle; review the edits against the new bundle and
update the script, then re-run `npm test`.

Line endings are normalised to LF by `.gitattributes`. `lib/client.js` is compared byte for byte
against the vendored output, so a CRLF checkout would fail both `npm test` and `npm run vendor:check`.

| Path | Purpose |
|---|---|
| `package.json` | Bundle and client manifest (`dsh.bundle.patch`, `dsh.client`) |
| `cordis.patch.yml` | Inserts the plugin row into the profile layer stack |
| `lib/index.js` | Node half (empty `apply`, so the row can mount) |
| `lib/client.js` | Vendored browser bundle with the six edits |
| `scripts/vendor-from-asar.mjs` | Vendoring: extract from an installed DSH, apply and verify the edits |
| `tests/verify-bundle.test.mjs` | Offline verification of the shipped bundle |
| `icon.svg`, `locale/*.json` | Plugin Manager card metadata |

## Limitations

- `lib/client.js` is a vendored copy of a built-in bundle, so it also requires
  `@deepseek-ai/dsh-client-ui-primitives`, `@deepseek-ai/cordis`, and
  `@deepseek-ai/dsh-client-store` from the browser module table (declared in
  `dsh.client.external`). A redesign of the built-in model selector in a future DSH release can
  break this bundle; `engines.dsh`, the vendoring script, and `npm test` are the guard rails.
- The plugin inherits the built-in control wholesale, including its stylesheet and its
  `min(360px, 45cqw)` trigger width; a long `Provider/Model` label is ellipsized rather than
  wrapped.
- The vendored bundle deliberately keeps the built-in plugin's whole service list (`commandUi`,
  `locale`, `sessions`, `slots`, `remote`, `remote.session`). The seat resolves its per-session
  catalog through the *consuming* context, so trimming the list to the services this plugin visibly
  uses throws `cannot get property "remote.session" without inject` on the first render after a
  launch; the slot registry then retires the crashing entry and the built-in seat renders instead —
  with no error shown anywhere. `npm run vendor` and `npm test` guard against that edit returning.
- No configuration: the format is fixed to `Provider/Model`.

## License

MIT. `lib/client.js` is derived from `@deepseek-ai/dsh-client-ui-model-selection` (MIT,
Copyright (c) DeepSeek). See [NOTICE.md](NOTICE.md).
