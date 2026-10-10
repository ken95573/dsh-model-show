# Staged registry entry (not part of the plugin)

`ken95573__dsh-model-show.yml` is the one-file submission for the curated
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
registry that the DSH plugin market (`dshmarket`) reads its catalog from. It is
kept here so the file is not lost between now and submission; it is **not** part
of the plugin and is excluded from the published package by `files` in
`package.json`.

Nothing here is loaded by DSH. After the upstream pull request is merged this
directory can be deleted.

## Where the file goes

Upstream, the list lives in `data/plugins/`, one YAML file per plugin, named
`<owner>__<repo>.yml` — so the file above is copied verbatim to
`data/plugins/ken95573__dsh-model-show.yml` in that repository. The READMEs
there are generated from those files and must not be edited by hand.

## Rules that apply to this entry

- `package.json` must declare `dsh.bundle` — it does (`./cordis.patch.yml`).
  A `dsh.client`-only manifest is the most common reason a submission is
  rejected.
- The repository must be at least one day old. `dsh-model-show` was created
  2026-10-10T12:49:03Z, so a pull request opens successfully from
  2026-10-11 20:49 (local, UTC+08:00) onwards.
- The repository needs the `dsh-plugin` topic.
- `description.en` is required; `zh` is optional (a maintainer adds it).
  A description containing `": "` must be quoted; keep the claim accurate — it
  is checked against the code.
- One pull request adds at most three entries. This one adds one.
- Screenshots are **not** an entry field. They are declared in this repository, in
  `screenshots.json` next to `package.json` (1-8 paths relative to that file), and the
  storefront picks them up from there — so screenshots can be changed later without another
  pull request. The upstream `data/screenshots.json` is a deprecated fallback: do not add keys
  to it.

## Pull request

Title:

    Add ken95573/dsh-model-show

Body:

    Adds one entry: `data/plugins/ken95573__dsh-model-show.yml`.

    - Repo: https://github.com/ken95573/dsh-model-show
    - The DSH Web composer model selector's collapsed trigger renders as
      `Provider/Model` (e.g. `Example Provider/Example Chat · High`) instead of
      the bare model name. The dropdown list and its search are deliberately
      unchanged.
    - `package.json` declares `dsh.bundle` (`./cordis.patch.yml`) and
      `dsh.client` (platform `web`), so it installs and activates through
      `dsh plugin add`.
    - No build step: the browser bundle is vendored and committed, so a source
      install needs no `prepare` script.
    - Category `model`: it changes the model selector, not general UI chrome.
