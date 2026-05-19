import { NOOP_LOGGER } from './logger.js';
import { execute as astro6 } from './presets/astro-6.js';
import { execute as awsCdk2 } from './presets/aws-cdk-2.js';
import { execute as awsCli2 } from './presets/aws-cli-2.js';
import { execute as betterAuth1 } from './presets/better-auth-1.js';
import { execute as bun1 } from './presets/bun-1.js';
import { execute as cakephp5 } from './presets/cakephp-5.js';
import { execute as claudeCode2 } from './presets/claude-code-2.js';
import { execute as cloudflareWorkers } from './presets/cloudflare-workers.js';
import { execute as commander14 } from './presets/commander-14.js';
import { execute as coreuiBootstrap5 } from './presets/coreui-bootstrap-5.js';
import { execute as coreuiVue5 } from './presets/coreui-vue-5.js';
import { execute as cytoscape3 } from './presets/cytoscape-3.js';
import { execute as deno2 } from './presets/deno-2.js';
import { execute as drizzle0 } from './presets/drizzle-0.js';
import { execute as handlebars4 } from './presets/handlebars-4.js';
import { execute as hono4 } from './presets/hono-4.js';
import { execute as jquery4 } from './presets/jquery-4.js';
import { execute as kysely0 } from './presets/kysely-0.js';
import { execute as laravel11 } from './presets/laravel-11.js';
import { execute as laravel12 } from './presets/laravel-12.js';
import { execute as mermaid11 } from './presets/mermaid-11.js';
import { execute as nextjs16 } from './presets/nextjs-16.js';
import { execute as octokitRest22 } from './presets/octokit-rest-22.js';
import { execute as payload3 } from './presets/payload-3.js';
import { execute as playwright1 } from './presets/playwright-1.js';
import { execute as prisma6 } from './presets/prisma-6.js';
import { execute as react19 } from './presets/react-19.js';
import { execute as remix2 } from './presets/remix-2.js';
import { execute as shadcnUi4 } from './presets/shadcn-ui-4.js';
import { execute as supabase2 } from './presets/supabase-2.js';
import { execute as svelte5 } from './presets/svelte-5.js';
import { execute as tailwindcss4 } from './presets/tailwindcss-4.js';
import { execute as tsMorph27 } from './presets/ts-morph-27.js';
import { execute as turborepo2 } from './presets/turborepo-2.js';
import { execute as typescript5 } from './presets/typescript-5.js';
import { execute as vitest4 } from './presets/vitest-4.js';
import { execute as vue3 } from './presets/vue-3.js';
import { execute as zod4 } from './presets/zod-4.js';
const EXECUTORS = {
    'astro-6': astro6,
    'aws-cdk-2': awsCdk2,
    'aws-cli-2': awsCli2,
    'better-auth-1': betterAuth1,
    'bun-1': bun1,
    'cakephp-5': cakephp5,
    'claude-code-2': claudeCode2,
    'cloudflare-workers': cloudflareWorkers,
    'commander-14': commander14,
    'coreui-bootstrap-5': coreuiBootstrap5,
    'coreui-vue-5': coreuiVue5,
    'cytoscape-3': cytoscape3,
    'deno-2': deno2,
    'drizzle-0': drizzle0,
    'handlebars-4': handlebars4,
    'hono-4': hono4,
    'jquery-4': jquery4,
    'kysely-0': kysely0,
    'laravel-11': laravel11,
    'laravel-12': laravel12,
    'mermaid-11': mermaid11,
    'nextjs-16': nextjs16,
    'octokit-rest-22': octokitRest22,
    'payload-3': payload3,
    'playwright-1': playwright1,
    'prisma-6': prisma6,
    'react-19': react19,
    'remix-2': remix2,
    'shadcn-ui-4': shadcnUi4,
    'supabase-2': supabase2,
    'svelte-5': svelte5,
    'tailwindcss-4': tailwindcss4,
    'ts-morph-27': tsMorph27,
    'turborepo-2': turborepo2,
    'typescript-5': typescript5,
    'vitest-4': vitest4,
    'vue-3': vue3,
    'zod-4': zod4,
};
export function loadPresetExecutor(name) {
    return Object.hasOwn(EXECUTORS, name) ? EXECUTORS[name] : null;
}
export async function executePreset(name, params) {
    const logger = params.logger ?? NOOP_LOGGER;
    const executor = loadPresetExecutor(name);
    if (!executor) {
        logger.error(`[${params.src.name}] プリセット "${name}" の execute が見つかりません。`);
        return params.stats;
    }
    return executor({ ...params, logger });
}
//# sourceMappingURL=execute-preset.js.map