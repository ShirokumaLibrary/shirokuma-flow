# SAST 導入手順モジュール（観点ごと・モジュール化）

> 使い方（orchestrator 向け）: 各節は独立モジュール。冒頭の `<!-- INCLUDE-IF: ... -->` マーカーが指す**診断で不足だった観点に対応する節だけ**をコピーして提示する（全節を毎回貼らない）。install コマンド・設定配置は**人の環境への外向き操作**なので、提示に留め、人の同意・実行を待つ（人ゲート）。採用した節の動作確認チェックを末尾「## 動作確認」に集める。

---

<!-- INCLUDE-IF: 診断 ① Semgrep バイナリが不足（semgrep --version が版を返さない）-->
## 節 A: Semgrep CE をインストールする（第2層）

Semgrep CE は npm の依存ではなく独立バイナリ（Python ツール）。プラグイン install では入らないので、環境に合わせて以下のいずれかで入れる。

- **pipx（推奨・隔離環境に入る）**: `pipx install semgrep`
- **pip**: `pip install semgrep`（venv 推奨。グローバルへ入れる場合は `pip install --user semgrep`）
- **Homebrew（macOS/Linuxbrew）**: `brew install semgrep`
- **Docker（ローカルに入れたくない場合）**: `docker run --rm -v "$(pwd):/src" semgrep/semgrep semgrep --version`（CLI 経由で使う場合はラッパー側の前提と合わないことがあるので、基本はネイティブ install を推奨）

導入確認: `semgrep --version` がバージョンを返す。

> ネットワーク制約下では registry フェッチに失敗しうるが、本セットアップは**同梱のローカルルール**で動くため registry へのアクセスは必須ではない（ルール解決の②③が常在/opt-in で効く）。

完了条件: `[ ] semgrep --version がバージョンを返す`

---

<!-- INCLUDE-IF: 診断 ② ESLint security 設定が不足（plugin 登録または devDeps が欠ける）-->
## 節 B: ESLint security（第1層）を導入する

自プロジェクトの TS/JS を security ルールで走査する第1層。**devDeps 追加**と**最小 flat config の配置**の 2 つを行う。

### B-1. devDeps を追加する

```sh
npm install -D eslint typescript-eslint eslint-plugin-security eslint-plugin-no-unsanitized
# pnpm: pnpm add -D eslint typescript-eslint eslint-plugin-security eslint-plugin-no-unsanitized
# yarn: yarn add -D eslint typescript-eslint eslint-plugin-security eslint-plugin-no-unsanitized
```

### B-2. 最小 flat config を配置する

プロジェクト root に `eslint.config.mjs` を置く（既存があれば**上書きせず差分を提示して人にマージ方針を確認**する）。初期は誤検知で開発を止めないよう **recommended を全件 warn** にし、混入時に即 fail させたい**高信頼ルールだけ ERROR** に昇格する初期ベースラインを採る。

```js
// SAST 第1層: eslint-plugin-security 系の最小 flat config。
// 初期方針: recommended は全件 warn（誤検知で止めない）。高信頼ルールのみ ERROR 昇格。
// 走査対象（files）はプロジェクトのソース配置に合わせて調整する。
import security from "eslint-plugin-security";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import tseslint from "typescript-eslint";

// 検出が出れば真陽性確度が高く、混入時は即 fail させたいルール。
const ERROR_RULES = {
  "security/detect-child-process": "error",
  "security/detect-eval-with-expression": "error",
  "security/detect-non-literal-require": "error",
  "security/detect-pseudoRandomBytes": "error",
  "security/detect-disable-mustache-escape": "error",
  "security/detect-bidi-characters": "error",
  "security/detect-buffer-noassert": "error",
};

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"] },
  {
    files: ["src/**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: {
      security,
      "no-unsanitized": noUnsanitized,
      // 既存 disable ディレクティブを解決させるため登録のみ（ルールは有効化しない）。
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...security.configs.recommended.rules, // 初期は全件 warn ベースライン
      "no-unsanitized/method": "warn",
      "no-unsanitized/property": "warn",
      ...ERROR_RULES, // 高信頼ルールのみ ERROR 昇格
    },
  }
);
```

導入確認: `npx eslint .`（または `package.json` の lint script）が走り、security 系ルールが評価される。FP 多発カテゴリ（`detect-object-injection`・`detect-non-literal-fs-filename` 等）の ERROR 昇格は、シグナルが安定してから人が段階的に確定する（初期は warn 据え置き）。

完了条件: `[ ] security 系 devDeps を追加した` / `[ ] eslint.config.* に security plugin を配置した（既存があればマージ確認済み）` / `[ ] npx eslint が security ルールを評価する`

### B-3. 真正の誤検知（FP）に出会ったときの抑止作法

ルールが拾った箇所が**攻撃者制御でないと判断できる真正の FP**（外部入力を経由しない・値が固定）なら、次のように抑止する。

- **Why コメント付きの行単位 `// eslint-disable-next-line security/<rule>` で抑止する**。なぜ安全かを同じ行/直前のコメントに残す（後から第三者が根拠を確認できる形にする）。
- **ファイル単位・ルール単位の off は採らない**（`/* eslint-disable */` やルール設定での無効化）。広く消すと将来の真陽性まで見えなくなる。
- **ルール設定（正本）は変更しない**。FP が同種で繰り返すなら、それは個別抑止ではなく**ルール育成のシグナル**として記録し、人の確定を経て正本側へ反映する（Semgrep 側の `// nosemgrep: <rule>` と同じ運用）。

```ts
// 環境変数アクセサ: name はビルド時固定の定数で外部入力を経由しない（真正 FP）。
// eslint-disable-next-line security/detect-object-injection
const value = process.env[name];
```

### B-4. 実行エントリを `quality.securityLintCommand` に宣言する（節 B の完了条件）

finalize の段 1 は `quality.securityLintCommand` に宣言されたコマンドだけを実行する。**宣言が無いと、B-1〜B-2 を済ませても段 1 は skip になる**（ESLint security は走らない）。

プロジェクトの config（`shirokuma-flow config get` が読む設定）の `quality` 節に、ESLint security を起動するコマンドを宣言する（例: `npx eslint .`。既に実行エントリの script を持っているなら、その起動コマンドを書く）。

```yaml
quality:
  securityLintCommand: npx eslint .
```

- **この値は無検証でシェル実行される**（コードと同じ信頼レベル）。本 skill は値を提示するところまでにし、**config へ書くのは人**。
- 完了の確認: `shirokuma-flow config get quality.securityLintCommand` が終了コード 0 で値を返すこと。

---

<!-- INCLUDE-IF: 診断 ③ プロジェクト固有ルールの上乗せ/上書きが必要と明示されたとき（任意・既定では不要）-->
## 節 C: Semgrep ルール上書き層を作る（任意）

> **任意**。ルール正本は同梱されており、`.shirokuma/semgrep/` が無くても動く。**プロジェクト固有のルールを上乗せ/上書きしたいときだけ**作る。

1. プロジェクト直下に `.shirokuma/semgrep/` を作る。
2. Semgrep ルール（`*.yml`）を置く。ここに置いたルールは正本解決で**最優先**になり、同梱ルールに上乗せされる。
3. `shirokuma-flow lint areas sast` を実走して、置いたルールが評価されることを確認する。

> 上書き層を空ディレクトリで置くと、同梱/拡張ルールが解決されない構成では `auto` 劣化（`sast-rules-degraded` warning）になりうる。空のまま放置しない。

完了条件: `[ ] .shirokuma/semgrep/ にルールを置いた` / `[ ] lint areas sast でそのルールが評価される`

---

## 動作確認（採用した節のチェックだけをここに集める）

- 上記で**採用した節の完了条件**を抜き出して並べる（不採用節は入れない）。
- [ ] Semgrep を導入した環境で `shirokuma-flow lint areas sast` を実行し、**skip でなく実走した（`SAST scan skipped` / skipReason が出ない）**ことを確認した。
- [ ] （実走時）検出 0 でも PASS で正常。`sast-rules-degraded` warning が出た場合は同梱正本ルールが見えているか／上書き層の置き方を確認した。
