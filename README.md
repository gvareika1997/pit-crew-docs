# pit-crew-docs

The documentation site of [Pit Crew](https://github.com/gvareika1997/pit-crew), built with Astro Starlight.

## Run it locally

Needs Node 22.12 or newer.

```bash
npm install
npm run dev        # http://localhost:4321/pit-crew-docs/
```

```bash
npm run build      # writes dist/, then runs scripts/check.mjs
npm run preview    # serves dist/ at http://localhost:4321/pit-crew-docs/
```

## What is here

| Section | Folder under `src/content/docs/` | Source in the pit-crew repo |
|---|---|---|
| Introduction | `index.mdx` | `README.md` |
| Getting started | `getting-started/` | `README.md`, `plugins/pit-crew/README.md`, `skills/setup/` |
| How it works | `how-it-works/` | `commands/*.md`, `skills/pipeline/` and its `resources/`, `skills/triage/`, `skills/brainstorm/`, `skills/pr/`, `hooks/` |
| Roles and adapters | `roles/` | `plugins/pit-crew/adapters/` |
| Packs | `packs/` | `docs/your-company-fork.md`, `docs/open-core-design.md`, `examples/pack-minimal/` |
| Reference | `reference/` | generated, see below |

Written against pit-crew `main` at `42bde34` (core plugin 6.1.0). Every claim comes from those files: when one of them changes, change the page.

## Generated reference

`reference/commands.mdx`, `skills.mdx`, `agents.mdx`, `hooks.mdx` and `glossary.mdx` are generated from the frontmatter of the plugin's commands, skills and agents, from `hooks/hooks.json` and from `CONTEXT.md`. Do not edit them by hand:

```bash
npm run reference -- /path/to/pit-crew
```

The output is committed, because this repository does not contain the plugin source.

## Build guards

`npm run build` fails when:

- an internal link, image or video does not resolve;
- a page is missing from the sidebar, or a sidebar entry has no page;
- a file contains a banned term. The core is neutral: it names roles, never a company's tools. The terms are one regex per line in `.docs-banned` (git-ignored) or in the `DOCS_BANNED` variable. With neither, this guard is skipped.

## Videos

`public/video/` holds the two videos as 720p MP4 files with a poster each. They are rendered from the HyperFrames projects with `npx hyperframes render`, then scaled down with ffmpeg. `src/components/Video.astro` embeds one by name.

## Publish

`.github/workflows/deploy.yml` builds on every pull request and deploys to GitHub Pages on a push to `main`. In the repository, set **Settings → Pages → Source** to **GitHub Actions** once.

The site URL defaults to `https://gvareika1997.github.io/pit-crew-docs/`. For another repository name or a custom domain, set `DOCS_SITE` and `DOCS_BASE` in the build step (`astro.config.mjs` and `scripts/check.mjs` read them) and add `public/CNAME` for a domain.

## License

Apache-2.0, the same as Pit Crew. The banner and the sticker in `src/assets/` come from the pit-crew repository.
