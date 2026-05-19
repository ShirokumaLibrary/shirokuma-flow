/**
 * 外部ドキュメントソースのプリセットレジストリ。
 * shirokuma-flow の `src/commands/docs/presets/*.ts` から各 `meta` export を静的データに
 * 集約したもの（ADR-0019 Phase 1b-1）。
 *
 * 値は as-is で保持し、fetch の execute ロジックは Phase 1b-2 以降で戻す。
 * ここでは `detect` / `list` の根拠データとして利用する。
 */
export const PRESETS = {
    'astro-6': {
        url: 'https://docs.astro.build/llms.txt',
        fullUrl: 'https://docs.astro.build/llms-full.txt',
        fetchStrategy: 'full-split',
        linkFormat: 'clean',
        splitPattern: '^# ',
        sectionFormatter: 'passthrough',
        packageNames: ['astro'],
    },
    'aws-cdk-2': {
        url: 'https://github.com/awsdocs/aws-cdk-guide',
        branch: 'main',
        repoPath: 'v2/guide',
        packageNames: ['aws-cdk-lib', 'aws-cdk'],
    },
    'aws-cli-2': {
        url: 'https://docs.aws.amazon.com/cli/latest/userguide/llms.txt',
    },
    'better-auth-1': {
        url: 'https://better-auth.com/llms.txt',
        fetchStrategy: 'individual',
        linkFormat: 'md',
        packageNames: ['better-auth'],
    },
    'bun-1': {
        url: 'https://bun.com/docs/llms.txt',
        fetchStrategy: 'individual',
        linkFormat: 'md',
        stripHeaderPattern: '^(>\\s.*\\n)+\\n?',
    },
    'cakephp-5': {
        url: 'https://github.com/cakephp/docs',
        branch: '5.x',
        repoPath: 'docs/en',
    },
    'claude-code-2': {
        url: 'https://code.claude.com/docs/llms.txt',
        fetchStrategy: 'individual',
        linkFormat: 'md',
        stripHeaderPattern: '^(>\\s.*\\n)+\\n?',
    },
    'cloudflare-workers': {
        url: 'https://developers.cloudflare.com/workers/llms.txt',
        fullUrl: 'https://developers.cloudflare.com/workers/llms-full.txt',
        fetchStrategy: 'full-split',
        linkFormat: 'clean',
        splitPattern: '^---$',
        sectionFormatter: 'passthrough',
        packageNames: ['wrangler', '@cloudflare/workers-types'],
    },
    'commander-14': {
        url: 'https://github.com/tj/commander.js',
        branch: 'master',
        repoPath: ['docs', 'examples'],
        packageNames: ['commander'],
    },
    'coreui-bootstrap-5': {
        url: 'https://github.com/coreui/coreui',
        branch: 'v5-bootstrap-compatible',
        repoPath: 'docs/content',
        packageNames: ['@coreui/coreui'],
    },
    'coreui-vue-5': {
        url: 'https://github.com/coreui/coreui-vue',
        branch: 'main',
        repoPath: 'packages/docs',
        packageNames: ['@coreui/vue'],
    },
    'cytoscape-3': {
        url: 'https://github.com/cytoscape/cytoscape.js',
        branch: 'master',
        repoPath: 'documentation/md',
        packageNames: ['cytoscape'],
    },
    'deno-2': {
        url: 'https://docs.deno.com/llms.txt',
        fetchStrategy: 'individual',
        linkFormat: 'clean',
    },
    'drizzle-0': {
        url: 'https://orm.drizzle.team/llms.txt',
        fullUrl: 'https://orm.drizzle.team/llms-full.txt',
        fetchStrategy: 'full-split',
        linkFormat: 'clean',
        splitPattern: '^Source: https://orm.drizzle.team/',
        sectionFormatter: 'metadata-to-frontmatter',
        packageNames: ['drizzle-orm', 'drizzle-kit'],
    },
    'handlebars-4': {
        url: 'https://github.com/handlebars-lang/docs',
        branch: 'master',
        repoPath: 'src',
        packageNames: ['handlebars'],
    },
    'hono-4': {
        url: 'https://hono.dev/llms.txt',
        fullUrl: 'https://hono.dev/llms-full.txt',
        fetchStrategy: 'full-split',
        linkFormat: 'clean',
        splitPattern: '^# ',
        sectionFormatter: 'passthrough',
        packageNames: ['hono'],
    },
    'jquery-4': {
        url: 'https://github.com/jquery/learn.jquery.com',
        branch: 'main',
        repoPath: 'page',
    },
    'kysely-0': {
        url: 'https://kysely.dev/llms.txt',
        fullUrl: 'https://kysely.dev/llms-full.txt',
        fetchStrategy: 'full-split',
        linkFormat: 'clean',
        splitPattern: '^# ',
        sectionFormatter: 'passthrough',
        packageNames: ['kysely'],
    },
    'laravel-11': {
        url: 'https://github.com/laravel/docs',
        branch: '11.x',
    },
    'laravel-12': {
        url: 'https://github.com/laravel/docs',
        branch: '12.x',
    },
    'mermaid-11': {
        url: 'https://github.com/mermaid-js/mermaid',
        branch: 'develop',
        repoPath: 'docs',
        packageNames: ['mermaid'],
    },
    'nextjs-16': {
        url: 'https://nextjs.org/docs/llms.txt',
        fetchStrategy: 'individual',
        linkFormat: 'clean',
        packageNames: ['next'],
    },
    'octokit-rest-22': {
        url: 'https://github.com/octokit/rest.js',
        branch: 'main',
        repoPath: 'docs/src/pages/api',
        packageNames: ['@octokit/rest', 'octokit'],
    },
    'payload-3': {
        url: 'https://payloadcms.com/llms.txt',
        fullUrl: 'https://payloadcms.com/llms-full.txt',
        fetchStrategy: 'full-split',
        linkFormat: 'clean',
        splitPattern: '^# ',
        sectionFormatter: 'passthrough',
        stripLinePattern: '^(Source:\\s+https?://|<[A-Z][A-Za-z]+(\\s|[/>]|$)|\\s*/>\\s*$)',
        packageNames: ['payload'],
    },
    'playwright-1': {
        url: 'https://github.com/microsoft/playwright',
        branch: 'main',
        repoPath: 'docs/src',
        packageNames: ['playwright', '@playwright/test'],
    },
    'prisma-6': {
        url: 'https://www.prisma.io/docs/llms.txt',
        fullUrl: 'https://www.prisma.io/docs/llms-full.txt',
        fetchStrategy: 'full-split',
        linkFormat: 'clean',
        splitPattern: '^# .+ \\(/docs',
        sectionFormatter: 'passthrough',
        packageNames: ['prisma', '@prisma/client'],
    },
    'react-19': {
        url: 'https://react.dev/llms.txt',
        fetchStrategy: 'individual',
        linkFormat: 'md',
        packageNames: ['react', 'react-dom'],
    },
    'remix-2': {
        url: 'https://github.com/remix-run/remix',
        branch: 'v2',
        repoPath: 'docs',
        packageNames: ['@remix-run/node', '@remix-run/react', '@remix-run/serve'],
    },
    'shadcn-ui-4': {
        url: 'https://ui.shadcn.com/llms.txt',
        fetchStrategy: 'individual',
        linkFormat: 'clean',
    },
    'supabase-2': {
        url: 'https://github.com/supabase/supabase',
        branch: 'master',
        repoPath: 'apps/docs/content/guides',
        packageNames: ['@supabase/supabase-js'],
    },
    'svelte-5': {
        url: 'https://svelte.dev/llms.txt',
        fullUrl: 'https://svelte.dev/llms-full.txt',
        fetchStrategy: 'full-split',
        linkFormat: 'clean',
        splitPattern: '^# ',
        sectionFormatter: 'passthrough',
        packageNames: ['svelte'],
    },
    'tailwindcss-4': {
        url: 'https://github.com/tailwindlabs/tailwindcss.com',
        branch: 'main',
        repoPath: 'src/docs',
        packageNames: ['tailwindcss'],
    },
    'ts-morph-27': {
        url: 'https://github.com/dsherret/ts-morph',
        branch: 'latest',
        repoPath: 'docs',
        packageNames: ['ts-morph'],
    },
    'turborepo-2': {
        url: 'https://turborepo.dev/llms.txt',
        fullUrl: 'https://turborepo.dev/llms-full.txt',
        fetchStrategy: 'full-split',
        linkFormat: 'md',
        splitPattern: '^---\\ntitle: ',
        sectionFormatter: 'passthrough',
        packageNames: ['turbo'],
    },
    'typescript-5': {
        url: 'https://github.com/microsoft/TypeScript-Website',
        branch: 'v2',
        packageNames: ['typescript'],
    },
    'vitest-4': {
        url: 'https://vitest.dev/llms.txt',
        fetchStrategy: 'individual',
        linkFormat: 'md',
        packageNames: ['vitest'],
    },
    'vue-3': {
        url: 'https://vuejs.org/llms.txt',
        fetchStrategy: 'individual',
        linkFormat: 'md',
        packageNames: ['vue'],
    },
    'zod-4': {
        url: 'https://zod.dev/llms.txt',
        fullUrl: 'https://zod.dev/llms-full.txt',
        fetchStrategy: 'full-split',
        linkFormat: 'clean',
        splitPattern: '^# ',
        sectionFormatter: 'passthrough',
        stripLinePattern: '^import .+ from [\'"](?:fumadocs-ui|@/components)/',
        packageNames: ['zod'],
    },
};
/** レジストリに登録されているプリセット名の一覧（ソート済み）。 */
export function listPresetNames() {
    return Object.keys(PRESETS).sort();
}
export function resolvePresetMeta(name) {
    return PRESETS[name] ?? null;
}
//# sourceMappingURL=presets.js.map