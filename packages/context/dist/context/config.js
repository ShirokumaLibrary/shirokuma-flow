import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
/** 設定ファイルの正規パス（プロジェクトルートからの相対）。 */
export const CONFIG_FILE = '.shirokuma/config.yaml';
/**
 * `.shirokuma/config.yaml` から contexts 設定を読み込む。
 * ファイル不在・パース失敗のいずれでも空オブジェクトを返す。
 *
 * @param projectPath - プロジェクトルートの絶対パス
 */
export function loadContextsConfig(projectPath) {
    const configPath = resolve(projectPath, CONFIG_FILE);
    let content;
    try {
        content = readFileSync(configPath, 'utf-8');
    }
    catch {
        return {};
    }
    try {
        const parsed = parseYaml(content);
        if (!parsed || typeof parsed !== 'object') {
            return {};
        }
        return { contexts: parsed.contexts };
    }
    catch {
        return {};
    }
}
//# sourceMappingURL=config.js.map