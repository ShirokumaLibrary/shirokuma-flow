import { PRESETS } from './presets.js';
import type { AnyPresetMeta } from './types.js';

export interface DetectedPreset {
  /** プリセット名（レジストリキー）。 */
  preset: string;
  /** 検出の根拠となった package.json 上のパッケージ名（1 つ以上）。 */
  matchedPackages: string[];
}

interface PackageJsonLike {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
}

/**
 * `package.json` の内容を受け取り、各依存がいずれかのプリセットの `packageNames`
 * に一致するかを評価する。一致したプリセットを重複なしで返す。
 *
 * 引数は「読み込んだ package.json オブジェクト」。ファイル I/O を呼び出し側に
 * 委ねることで Node 依存を下げ、Bun / Deno / ブラウザ環境からも利用できる。
 */
export function detectFromPackageJson(pkg: PackageJsonLike): DetectedPreset[] {
  const installed = collectDependencyNames(pkg);
  if (installed.size === 0) return [];

  const results: DetectedPreset[] = [];
  for (const [preset, meta] of Object.entries(PRESETS) as [string, AnyPresetMeta][]) {
    const declared = meta.packageNames;
    if (!declared?.length) continue;
    const matched = declared.filter((name: string) => installed.has(name));
    if (matched.length > 0) {
      results.push({ preset, matchedPackages: matched });
    }
  }
  return results;
}

function collectDependencyNames(pkg: PackageJsonLike): Set<string> {
  const names = new Set<string>();
  for (const field of [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.peerDependencies,
    pkg.optionalDependencies,
  ]) {
    if (field && typeof field === 'object' && !Array.isArray(field)) {
      for (const name of Object.keys(field)) names.add(name);
    }
  }
  return names;
}
