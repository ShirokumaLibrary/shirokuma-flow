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
export declare function detectFromPackageJson(pkg: PackageJsonLike): DetectedPreset[];
export {};
//# sourceMappingURL=detect.d.ts.map