/**
 * hooks evaluate - Evaluate destructive command rules
 *
 * stdin から PreToolUse JSON を読み取り、破壊的コマンドを評価する。
 * - 拒否時: Claude Code hook 出力形式の JSON を stdout に出力し exit 0
 * - 許可時: 何も出力せず exit 0
 * - エラー時: fail-open（全許可）
 */
export interface BlockedCommandRule {
    id: string;
    pattern: string;
    reason: string;
    enabled: boolean;
}
/**
 * blocked-commands.json からルールを読み込む
 *
 * バンドルプラグイン → グローバルキャッシュの2段階フォールバック。
 * 見つからない場合は空配列を返す（fail-open）。
 */
export declare function loadBlockedCommands(): BlockedCommandRule[];
/**
 * hooks.allow に基づきアクティブルールをフィルタする
 */
export declare function filterActiveRules(rules: BlockedCommandRule[], allowIds: string[] | undefined): BlockedCommandRule[];
/**
 * コマンドから heredoc ブロックを除去する
 *
 * <<'DELIMITER'..DELIMITER, <<"DELIMITER"..DELIMITER, <<DELIMITER..DELIMITER,
 * <<-DELIMITER..DELIMITER 形式のコンテンツをプレースホルダーに置き換える。
 */
export declare function stripHeredocs(command: string): string;
/**
 * コマンドから Markdown コードブロックを除去する
 *
 * ``` または ``` lang で囲まれたブロックのコンテンツをプレースホルダーに置き換える。
 */
export declare function stripCodeBlocks(command: string): string;
/**
 * コマンドからクォート文字列を除去する
 *
 * 処理順序:
 * 1. heredoc ブロック除去（複数行コンテンツ）
 * 2. Markdown コードブロック除去
 * 3. 改行をスペースに変換（残った改行を正規化）
 * 4. シングル/ダブルクォート内テキスト除去
 */
export declare function stripQuotedStrings(command: string): string;
/**
 * コマンドをアクティブルールのパターンでマッチングする
 *
 * @returns マッチしたルール、またはマッチなしの場合 null
 */
export declare function evaluateCommand(command: string, activeRules: BlockedCommandRule[]): BlockedCommandRule | null;
/**
 * `hooks evaluate` コマンドのメインハンドラ
 */
export declare function hooksEvaluateCommand(configPath?: string): Promise<void>;
//# sourceMappingURL=evaluate.d.ts.map