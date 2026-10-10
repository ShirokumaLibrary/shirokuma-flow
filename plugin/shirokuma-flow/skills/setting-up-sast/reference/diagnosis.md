# SAST 導入診断の判定手順（read-only）

> 使い方（orchestrator 向け）: SKILL.md 手順 1 で 3 観点を機械的に判定するときに読む。すべて read-only——install も設定変更もしない。判定結果を診断表（観点 / 状態 / 不足時の対処）に落とす。

---

## 観点① Semgrep バイナリ

- **確認**: `semgrep --version` を実行する。
- **充足**: バージョン文字列（例 `1.x.y`）が返る。
- **不足**: `command not found` / 非ゼロ exit。→ install-tasks 節 A。
- 補足: Semgrep は npm の依存ではなく独立バイナリ（pipx/pip/brew で入れる Python ツール）。プラグイン install だけでは入らない。

---

## 観点② ESLint security 設定

3 つを確認する。**plugin/rules の宣言**と**依存の実体**と**実行エントリの宣言**が揃って初めて充足。

- **設定ファイル**: プロジェクト root の `eslint.config.*`（`.mjs` / `.js` / `.cjs` / `.ts`）に `eslint-plugin-security` の plugin 登録と recommended rules、必要なら `eslint-plugin-no-unsanitized` があるか。
- **依存の実体**: `package.json` の `devDependencies`（または `dependencies`）に `eslint-plugin-security`・`eslint-plugin-no-unsanitized`、および ESLint 本体が入っているか。
- **実行エントリの宣言**: `shirokuma-flow config get quality.securityLintCommand` が終了コード 0 かつ非空の値を返すか（finalize の段 1 はこの値だけを実行する。未宣言だと導入済みでも段 1 は skip になる）。
- **充足**: 設定ファイルに security 系 plugin の登録があり、対応する devDeps も入っており、`quality.securityLintCommand` が宣言されている。
- **不足**: 設定ファイルが無い／security plugin の登録が無い／devDeps が欠ける／`quality.securityLintCommand` が未宣言。→ install-tasks 節 B。
- 補足: ESLint flat config（`eslint.config.*`）前提。旧 `.eslintrc` 系は flat config への移行を案内に含めてよい。設定はあるが devDeps が無い（またはその逆）は**片落ち＝不足**として扱う。

---

## 観点③ Semgrep ルール上書き層（任意）

- **確認**: プロジェクト直下 `.shirokuma/semgrep/` ディレクトリの有無。
- **判定**: **任意**。無いのが既定で正常。
- **理由**: Semgrep のルール正本は 4 段で解決される——①プロジェクト `.shirokuma/semgrep/` 上書き → ②flow パッケージ dist 同梱の正本ルール → ③導入済みの拡張（Next.js 等）の同梱ルール（拡張導入時のみ自動で加わる）→ ④①〜③がいずれもゼロ件のときだけ registry `auto` 劣化。**②が常在**するため、`.shirokuma/semgrep/` が無くても同梱正本で動く。
- **報告**: 診断表では「任意・未作成（既定どおり同梱正本で動く）」とし、**不足扱いにしない**。プロジェクト固有ルールを上乗せ/上書きしたいと明示されたときだけ install-tasks 節 C を案内する。
- **劣化の合図**: `lint areas sast` 実走時に `sast-rules-degraded` warning が出たら、①〜③がすべてゼロ件で `auto` に落ちた合図。dist 同梱ルールが見えていない（配布物が壊れている等）か、上書き層を空で置いた可能性を疑う。

---

## 動作確認の判定（手順 4 の完了条件）

- `shirokuma-flow lint areas sast` の出力に **`SAST scan skipped` / skipReason が出ない**ことが完了条件。
- skip が出る＝Semgrep 未導入。観点①の導入が未完了。**skip を成功と誤認しない**。
- `SAST scan did not complete`（終了コード 2）が出る＝Semgrep は導入済みだが実行に失敗した（イメージ欠落・設定誤り・registry 取得のネット不可など）。メッセージの `Semgrep error:` 以降を読んで原因を取り除く。
- 実走できていれば検出 0 でも PASS で正常（ゲートを通過する＝劣化動作）。
