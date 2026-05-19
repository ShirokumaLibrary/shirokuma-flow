/**
 * Commander.js の親子サブコマンド option 解決ヘルパー。
 *
 * 親と子の両方が同名 option を宣言している場合、Commander は CLI トークンを親で parse し、
 * 子の localOpts は default 値のまま残る。素朴な `{ ...parent, ...local }` merge では
 * 子の default が親の CLI 値を上書きする shadowing が発生する（Issue #2519）。
 *
 * このヘルパーは `getOptionValueSource()` で子値が "default" かつ祖先のいずれかで明示指定が
 * ある場合のみ、直近祖先の値を優先するロジックを実装する。
 *
 * 3 階層以上のコマンドツリー（例: `discussions templates generate`）にも対応する。
 * root → 直接親の順で opts を merge し、最後に localOpts を merge する。
 *
 * 戻り値は呼び出し側固有オプションと共通オプションの intersection 型相当だが、
 * Commander.js は実行時に型付き option のみ登録するため、境界での any キャストは安全。
 *
 * 引数型は commander の `Command` 型を直接 import せず、必要最小限の structural interface
 * （`MergeableCommand`）で受ける。flow（commander v14）/ portal・lint（commander v12）等、
 * パッケージ間で commander のメジャーバージョンが異なる場合の型不一致を吸収するため。
 */
export interface MergeableCommand {
    readonly parent?: MergeableCommand | null;
    opts(): Record<string, unknown>;
    getOptionValueSource(key: string): string | undefined;
}
export declare function mergeCommanderOpts(command: MergeableCommand, localOpts: Record<string, unknown>): any;
//# sourceMappingURL=commander-opts.d.ts.map