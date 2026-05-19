export interface RemoveSourceParams {
    projectPath: string;
    sourceName: string;
    docsRoot?: string;
    /** 特定ソースの `outputDir` を config から上書き指定する場合。 */
    sourceOutputDir?: string;
}
export interface RemoveSourceResult {
    removed: boolean;
    outputDir: string;
}
/**
 * 指定ソースのディレクトリを削除し、MANIFEST からも該当エントリを落とす。
 * 未存在は `removed: false` を返す（エラーではない）。
 * CLI 層の確認フローや error コード付与は consumer に委ねる。
 */
export declare function removeSource(params: RemoveSourceParams): RemoveSourceResult;
//# sourceMappingURL=remove.d.ts.map