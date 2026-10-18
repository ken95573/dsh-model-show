# NOTICE

## Derived work

`lib/client.js` is a **vendored, modified copy** of the browser bundle shipped with the DSH
built-in plugin `@deepseek-ai/dsh-client-ui-model-selection`
(`dsh/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js` inside the
installed application's `resources/app.asar`).

- Upstream package: `@deepseek-ai/dsh-client-ui-model-selection` (vendored from the
  `0.2.0-rc.2` and later the `0.2.1-rc.2` desktop builds)
- Upstream license: MIT (Copyright (c) DeepSeek)
- This package: MIT (see `LICENSE`)

The upstream bundle is MIT-licensed, so redistributing a modified copy is permitted as long as
the copyright notice and permission notice are preserved. The upstream bundle carries no inline
license header; this NOTICE and the `LICENSE` file serve that purpose.

## What was changed

`scripts/vendor-from-asar.mjs` performs the six edits and documents each one in place with an
`EDIT:` comment inside the generated file:

1. Module-loader id → `dsh-model-show` (must equal this package's name).
2. Locale namespace → `dsh-model-show` (the built-in plugin already owns `"model"`).
3. The `ModelDirectoryResolver` mount is removed: the built-in plugin keeps owning the shared
   model catalog and the `modelDirectories` service this plugin consumes.
4. The `/model` command registration is removed: the built-in plugin already registers it.
5. `choices[].model.name` becomes `` `${group.name}/${model.name}` `` so the composer trigger
   reads `Provider/Model`.
6. The composer seat is registered with `priority: -1`, which shadows the built-in seat
   (lowest priority renders, and an equal priority would collide).

The upstream `inject` list is left untouched on purpose: the seat resolves its per-session catalog
through the consuming context, so `remote` / `remote.session` must stay declared — trimming the list
makes the first render after a launch throw and the seat is silently retired.

Everything else — the component, its stylesheet, the dictionaries, and the untouched menu
rendering — is upstream code.

## Runtime dependencies from the browser module table

The vendored bundle `require()`s `@deepseek-ai/dsh-client-ui-primitives`,
`@deepseek-ai/cordis`, and `@deepseek-ai/dsh-client-store` in addition to `react`,
`react/jsx-runtime`, and `react-dom`. All six resolve from the Web shell's static module table;
the Harness packages are declared in `dsh.client.external`. Harness plugin guidance discourages
depending on Client packages because they change without notice; this plugin accepts that
trade-off to render the built-in control unchanged, and guards it with `engines.dsh`, the
vendoring script's loud anchor failures, and `npm test`.
