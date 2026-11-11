// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

// Defaults fit a project site at https://gvareika1997.github.io/pit-crew-docs/.
// For a custom domain: DOCS_SITE=https://docs.example.com DOCS_BASE=/ plus public/CNAME.
const site = process.env.DOCS_SITE ?? 'https://gvareika1997.github.io';
const base = process.env.DOCS_BASE ?? '/pit-crew-docs';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [
    // Must come before Starlight so ```mermaid fences are picked up.
    mermaid({ autoTheme: true }),
    starlight({
      title: 'Pit Crew',
      description:
        'A four-phase feature delivery pipeline for Claude Code: from a ticket to a reviewed, verified pull request.',
      logo: { src: './src/assets/pit-crew-sticker.svg', alt: '' },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/theme.css'],
      lastUpdated: true,
      // The plugin repository is private, so the link goes to this site's own repository.
      social: [
        { icon: 'github', label: 'Docs source on GitHub', href: 'https://github.com/gvareika1997/pit-crew-docs' },
      ],
      sidebar: [
        { label: 'Introduction', link: '/' },
        {
          label: 'Getting started',
          items: [
            { label: 'Install', slug: 'getting-started/install' },
            { label: 'Setup and health check', slug: 'getting-started/setup' },
            { label: 'Your first run', slug: 'getting-started/first-run' },
            { label: 'Connect your tools', slug: 'getting-started/connect-your-tools' },
            { label: 'Videos', slug: 'getting-started/videos' },
          ],
        },
        {
          label: 'How it works',
          items: [
            { label: 'Why Pit Crew', slug: 'how-it-works/why' },
            { label: 'The flow', slug: 'how-it-works/the-flow' },
            { label: 'Lanes', slug: 'how-it-works/lanes' },
            {
              label: 'The four phases',
              items: [
                { label: '1 · Plan', slug: 'how-it-works/plan' },
                { label: '2 · Dev', slug: 'how-it-works/dev' },
                { label: '3 · Test', slug: 'how-it-works/test' },
                { label: '4 · Deploy', slug: 'how-it-works/deploy' },
              ],
            },
            { label: 'Evidence and PRs', slug: 'how-it-works/evidence-and-prs' },
            { label: 'Bug triage', slug: 'how-it-works/triage' },
            { label: 'Product mode', slug: 'how-it-works/product-mode' },
            { label: 'Brainstorm', slug: 'how-it-works/brainstorm' },
            { label: 'Guardrails', slug: 'how-it-works/guardrails' },
            { label: 'State and reports', slug: 'how-it-works/state-and-reports' },
          ],
        },
        {
          label: 'Roles and adapters',
          items: [
            { label: 'Roles and bindings', slug: 'roles' },
            {
              label: 'The nine roles',
              collapsed: true,
              items: [
                { label: 'tracker', slug: 'roles/tracker' },
                { label: 'docs', slug: 'roles/docs' },
                { label: 'env', slug: 'roles/env' },
                { label: 'logs', slug: 'roles/logs' },
                { label: 'data', slug: 'roles/data' },
                { label: 'review', slug: 'roles/review' },
                { label: 'deploy', slug: 'roles/deploy' },
                { label: 'events', slug: 'roles/events' },
                { label: 'stack', slug: 'roles/stack' },
              ],
            },
            { label: 'Write an adapter', slug: 'roles/write-an-adapter' },
            { label: 'Telemetry', slug: 'roles/telemetry' },
          ],
        },
        {
          label: 'Packs',
          items: [
            { label: 'What a pack is', slug: 'packs' },
            { label: 'Write a pack', slug: 'packs/write-a-pack' },
            { label: 'Open core design', slug: 'packs/open-core-design' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Commands', slug: 'reference/commands' },
            { label: 'Skills', slug: 'reference/skills' },
            { label: 'Agents', slug: 'reference/agents' },
            { label: 'Hooks', slug: 'reference/hooks' },
            { label: 'Environment', slug: 'reference/environment' },
            { label: 'Glossary', slug: 'reference/glossary' },
          ],
        },
      ],
    }),
  ],
});
