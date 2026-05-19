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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeCommanderOpts(command, localOpts) {
    // 祖先を直接親 → 祖父 の順で集める（root program は除外）。
    // root program のグローバル option（例: --locale, --no-color）は
    // subcommand の action options に意図せず注入されると将来的な命名衝突や
    // shadowing risk の原因となるため、明示的に除外する（PR #2526 review Medium-1）。
    const ancestors = [];
    let cursor = command.parent;
    while (cursor) {
        // cursor.parent が無い = cursor が root program。これは ancestor に含めない。
        if (!cursor.parent)
            break;
        ancestors.push(cursor);
        cursor = cursor.parent;
    }
    // root → 直接親の順で merge（直接親が最も浅い → localOpts に最も近い）
    const ancestorOpts = {};
    for (let i = ancestors.length - 1; i >= 0; i--) {
        Object.assign(ancestorOpts, ancestors[i].opts());
    }
    const merged = { ...ancestorOpts, ...localOpts };
    // shadowing 解消: localOpts のキーが default かつ祖先のいずれかが explicit なら直近祖先を優先
    for (const key of Object.keys(localOpts)) {
        const childSource = command.getOptionValueSource(key);
        if (childSource !== "default")
            continue;
        for (const ancestor of ancestors) {
            const src = ancestor.getOptionValueSource(key);
            if (src && src !== "default") {
                merged[key] = ancestor.opts()[key];
                break;
            }
        }
    }
    return merged;
}
//# sourceMappingURL=commander-opts.js.map