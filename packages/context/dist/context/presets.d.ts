import type { AnyPresetMeta } from './types.js';
/**
 * 外部ドキュメントソースのプリセットレジストリ。
 * shirokuma-flow の `src/commands/docs/presets/*.ts` から各 `meta` export を静的データに
 * 集約したもの（ADR-0019 Phase 1b-1）。
 *
 * 値は as-is で保持し、fetch の execute ロジックは Phase 1b-2 以降で戻す。
 * ここでは `detect` / `list` の根拠データとして利用する。
 */
export declare const PRESETS: {
    readonly 'astro-6': {
        readonly url: "https://docs.astro.build/llms.txt";
        readonly fullUrl: "https://docs.astro.build/llms-full.txt";
        readonly fetchStrategy: "full-split";
        readonly linkFormat: "clean";
        readonly splitPattern: "^# ";
        readonly sectionFormatter: "passthrough";
        readonly packageNames: readonly ["astro"];
    };
    readonly 'aws-cdk-2': {
        readonly url: "https://github.com/awsdocs/aws-cdk-guide";
        readonly branch: "main";
        readonly repoPath: "v2/guide";
        readonly packageNames: readonly ["aws-cdk-lib", "aws-cdk"];
    };
    readonly 'aws-cli-2': {
        readonly url: "https://docs.aws.amazon.com/cli/latest/userguide/llms.txt";
    };
    readonly 'better-auth-1': {
        readonly url: "https://better-auth.com/llms.txt";
        readonly fetchStrategy: "individual";
        readonly linkFormat: "md";
        readonly packageNames: readonly ["better-auth"];
    };
    readonly 'bun-1': {
        readonly url: "https://bun.com/docs/llms.txt";
        readonly fetchStrategy: "individual";
        readonly linkFormat: "md";
        readonly stripHeaderPattern: "^(>\\s.*\\n)+\\n?";
    };
    readonly 'cakephp-5': {
        readonly url: "https://github.com/cakephp/docs";
        readonly branch: "5.x";
        readonly repoPath: "docs/en";
    };
    readonly 'claude-code-2': {
        readonly url: "https://code.claude.com/docs/llms.txt";
        readonly fetchStrategy: "individual";
        readonly linkFormat: "md";
        readonly stripHeaderPattern: "^(>\\s.*\\n)+\\n?";
    };
    readonly 'cloudflare-workers': {
        readonly url: "https://developers.cloudflare.com/workers/llms.txt";
        readonly fullUrl: "https://developers.cloudflare.com/workers/llms-full.txt";
        readonly fetchStrategy: "full-split";
        readonly linkFormat: "clean";
        readonly splitPattern: "^---$";
        readonly sectionFormatter: "passthrough";
        readonly packageNames: readonly ["wrangler", "@cloudflare/workers-types"];
    };
    readonly 'commander-14': {
        readonly url: "https://github.com/tj/commander.js";
        readonly branch: "master";
        readonly repoPath: readonly ["docs", "examples"];
        readonly packageNames: readonly ["commander"];
    };
    readonly 'coreui-bootstrap-5': {
        readonly url: "https://github.com/coreui/coreui";
        readonly branch: "v5-bootstrap-compatible";
        readonly repoPath: "docs/content";
        readonly packageNames: readonly ["@coreui/coreui"];
    };
    readonly 'coreui-vue-5': {
        readonly url: "https://github.com/coreui/coreui-vue";
        readonly branch: "main";
        readonly repoPath: "packages/docs";
        readonly packageNames: readonly ["@coreui/vue"];
    };
    readonly 'cytoscape-3': {
        readonly url: "https://github.com/cytoscape/cytoscape.js";
        readonly branch: "master";
        readonly repoPath: "documentation/md";
        readonly packageNames: readonly ["cytoscape"];
    };
    readonly 'deno-2': {
        readonly url: "https://docs.deno.com/llms.txt";
        readonly fetchStrategy: "individual";
        readonly linkFormat: "clean";
    };
    readonly 'drizzle-0': {
        readonly url: "https://orm.drizzle.team/llms.txt";
        readonly fullUrl: "https://orm.drizzle.team/llms-full.txt";
        readonly fetchStrategy: "full-split";
        readonly linkFormat: "clean";
        readonly splitPattern: "^Source: https://orm.drizzle.team/";
        readonly sectionFormatter: "metadata-to-frontmatter";
        readonly packageNames: readonly ["drizzle-orm", "drizzle-kit"];
    };
    readonly 'handlebars-4': {
        readonly url: "https://github.com/handlebars-lang/docs";
        readonly branch: "master";
        readonly repoPath: "src";
        readonly packageNames: readonly ["handlebars"];
    };
    readonly 'hono-4': {
        readonly url: "https://hono.dev/llms.txt";
        readonly fullUrl: "https://hono.dev/llms-full.txt";
        readonly fetchStrategy: "full-split";
        readonly linkFormat: "clean";
        readonly splitPattern: "^# ";
        readonly sectionFormatter: "passthrough";
        readonly packageNames: readonly ["hono"];
    };
    readonly 'jquery-4': {
        readonly url: "https://github.com/jquery/learn.jquery.com";
        readonly branch: "main";
        readonly repoPath: "page";
    };
    readonly 'kysely-0': {
        readonly url: "https://kysely.dev/llms.txt";
        readonly fullUrl: "https://kysely.dev/llms-full.txt";
        readonly fetchStrategy: "full-split";
        readonly linkFormat: "clean";
        readonly splitPattern: "^# ";
        readonly sectionFormatter: "passthrough";
        readonly packageNames: readonly ["kysely"];
    };
    readonly 'laravel-11': {
        readonly url: "https://github.com/laravel/docs";
        readonly branch: "11.x";
    };
    readonly 'laravel-12': {
        readonly url: "https://github.com/laravel/docs";
        readonly branch: "12.x";
    };
    readonly 'mermaid-11': {
        readonly url: "https://github.com/mermaid-js/mermaid";
        readonly branch: "develop";
        readonly repoPath: "docs";
        readonly packageNames: readonly ["mermaid"];
    };
    readonly 'nextjs-16': {
        readonly url: "https://nextjs.org/docs/llms.txt";
        readonly fetchStrategy: "individual";
        readonly linkFormat: "clean";
        readonly packageNames: readonly ["next"];
    };
    readonly 'octokit-rest-22': {
        readonly url: "https://github.com/octokit/rest.js";
        readonly branch: "main";
        readonly repoPath: "docs/src/pages/api";
        readonly packageNames: readonly ["@octokit/rest", "octokit"];
    };
    readonly 'payload-3': {
        readonly url: "https://payloadcms.com/llms.txt";
        readonly fullUrl: "https://payloadcms.com/llms-full.txt";
        readonly fetchStrategy: "full-split";
        readonly linkFormat: "clean";
        readonly splitPattern: "^# ";
        readonly sectionFormatter: "passthrough";
        readonly stripLinePattern: "^(Source:\\s+https?://|<[A-Z][A-Za-z]+(\\s|[/>]|$)|\\s*/>\\s*$)";
        readonly packageNames: readonly ["payload"];
    };
    readonly 'playwright-1': {
        readonly url: "https://github.com/microsoft/playwright";
        readonly branch: "main";
        readonly repoPath: "docs/src";
        readonly packageNames: readonly ["playwright", "@playwright/test"];
    };
    readonly 'prisma-6': {
        readonly url: "https://www.prisma.io/docs/llms.txt";
        readonly fullUrl: "https://www.prisma.io/docs/llms-full.txt";
        readonly fetchStrategy: "full-split";
        readonly linkFormat: "clean";
        readonly splitPattern: "^# .+ \\(/docs";
        readonly sectionFormatter: "passthrough";
        readonly packageNames: readonly ["prisma", "@prisma/client"];
    };
    readonly 'react-19': {
        readonly url: "https://react.dev/llms.txt";
        readonly fetchStrategy: "individual";
        readonly linkFormat: "md";
        readonly packageNames: readonly ["react", "react-dom"];
    };
    readonly 'remix-2': {
        readonly url: "https://github.com/remix-run/remix";
        readonly branch: "v2";
        readonly repoPath: "docs";
        readonly packageNames: readonly ["@remix-run/node", "@remix-run/react", "@remix-run/serve"];
    };
    readonly 'shadcn-ui-4': {
        readonly url: "https://ui.shadcn.com/llms.txt";
        readonly fetchStrategy: "individual";
        readonly linkFormat: "clean";
    };
    readonly 'supabase-2': {
        readonly url: "https://github.com/supabase/supabase";
        readonly branch: "master";
        readonly repoPath: "apps/docs/content/guides";
        readonly packageNames: readonly ["@supabase/supabase-js"];
    };
    readonly 'svelte-5': {
        readonly url: "https://svelte.dev/llms.txt";
        readonly fullUrl: "https://svelte.dev/llms-full.txt";
        readonly fetchStrategy: "full-split";
        readonly linkFormat: "clean";
        readonly splitPattern: "^# ";
        readonly sectionFormatter: "passthrough";
        readonly packageNames: readonly ["svelte"];
    };
    readonly 'tailwindcss-4': {
        readonly url: "https://github.com/tailwindlabs/tailwindcss.com";
        readonly branch: "main";
        readonly repoPath: "src/docs";
        readonly packageNames: readonly ["tailwindcss"];
    };
    readonly 'ts-morph-27': {
        readonly url: "https://github.com/dsherret/ts-morph";
        readonly branch: "latest";
        readonly repoPath: "docs";
        readonly packageNames: readonly ["ts-morph"];
    };
    readonly 'turborepo-2': {
        readonly url: "https://turborepo.dev/llms.txt";
        readonly fullUrl: "https://turborepo.dev/llms-full.txt";
        readonly fetchStrategy: "full-split";
        readonly linkFormat: "md";
        readonly splitPattern: "^---\\ntitle: ";
        readonly sectionFormatter: "passthrough";
        readonly packageNames: readonly ["turbo"];
    };
    readonly 'typescript-5': {
        readonly url: "https://github.com/microsoft/TypeScript-Website";
        readonly branch: "v2";
        readonly packageNames: readonly ["typescript"];
    };
    readonly 'vitest-4': {
        readonly url: "https://vitest.dev/llms.txt";
        readonly fetchStrategy: "individual";
        readonly linkFormat: "md";
        readonly packageNames: readonly ["vitest"];
    };
    readonly 'vue-3': {
        readonly url: "https://vuejs.org/llms.txt";
        readonly fetchStrategy: "individual";
        readonly linkFormat: "md";
        readonly packageNames: readonly ["vue"];
    };
    readonly 'zod-4': {
        readonly url: "https://zod.dev/llms.txt";
        readonly fullUrl: "https://zod.dev/llms-full.txt";
        readonly fetchStrategy: "full-split";
        readonly linkFormat: "clean";
        readonly splitPattern: "^# ";
        readonly sectionFormatter: "passthrough";
        readonly stripLinePattern: "^import .+ from ['\"](?:fumadocs-ui|@/components)/";
        readonly packageNames: readonly ["zod"];
    };
};
export type PresetName = keyof typeof PRESETS;
/** レジストリに登録されているプリセット名の一覧（ソート済み）。 */
export declare function listPresetNames(): PresetName[];
/**
 * 指定名のプリセットメタを返す。未登録なら `null`。
 * 名前が `PresetName` としてリテラル既知なら、具体的な variant 型に narrow される。
 */
export declare function resolvePresetMeta<N extends PresetName>(name: N): (typeof PRESETS)[N];
export declare function resolvePresetMeta(name: string): AnyPresetMeta | null;
//# sourceMappingURL=presets.d.ts.map