---
name: coding-cdk
description: AWS CDK（TypeScript）でインフラコンストラクトの実装・修正を行う。designing-aws の設計成果物をもとに L2/L3 コンストラクト実装・スタック分割・環境別設定管理・CI/CD 連携を担当。Use when 「CDK実装」「CDKコンストラクト」「CDKスタック」「インフラ実装」「cdk deploy」「cdk synth」と言われたとき。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# CDK コーディング

`designing-aws` が出力したAWS リソース設計をもとに、AWS CDK（TypeScript）コンストラクトの実装・修正を行う。

## スコープ

- **カテゴリ:** 変更系ワーカー
- **スコープ:** CDK コンストラクトの実装・修正（Write / Edit / Bash）。`designing-aws` の設計成果物をもとに、L2/L3 コンストラクト、スタック分割、環境別設定管理、CI/CD 連携を実装する。CDK v2 TypeScript を前提とする。
- **スコープ外:** AWS リソースの選定・設計判断（`designing-aws` に委任）、docker-compose によるローカル環境構築（`coding-infra` に委任）

## 開始前に

1. プロジェクトの `CLAUDE.md` で CDK バージョン（v1/v2）・言語・ディレクトリ構成を確認
2. `designing-aws` の設計成果物（Issue 本文の「AWS リソース設計」セクション）を読み込む
3. 既存 CDK スタック構成（`infra/` や `cdk/` ディレクトリ）を確認
4. [reference/patterns/cdk-constructs.md](reference/patterns/cdk-constructs.md) の L2/L3 使い分けを確認

## ワークフロー

### ステップ 1: プロジェクト構成確認

```bash
# CDK プロジェクト構造確認
ls -la {infra-dir}/
cat {infra-dir}/cdk.json
cat {infra-dir}/package.json | grep -E '"aws-cdk|constructs'

# 既存スタック一覧
find {infra-dir} -name '*.ts' | head -20
```

確認事項:
- CDK バージョン（`aws-cdk-lib` のバージョン）
- エントリーポイント（`bin/*.ts`）
- 既存スタック・コンストラクト構成
- `cdk.json` の `context` キー

### ステップ 2: 実装計画

進捗トラッカー（全ステップの一覧）を作成し、開始時・完了時に状態を更新する。**登録はスキップ不可。** 本 skill の `allowed-tools` はタスク管理ツールを宣言していないので、**手段は応答本文に状態つき（`todo` / `in_progress` / `done`）の手順表を残し、更新のたびに書き直す形へ倒す**（ツールで登録したいなら `allowed-tools` を変える判断が先に要る＝ここで暗黙に分岐しない。**ツールの存否は推測せず実測し、手段を選んだ回はその根拠——ここでは宣言側の不在——を申告に添える**。分岐条件を判定するのはその分岐で楽になる当人なので、観測を名指さない不在申告は自己申告のまま残る）。**どちらの手段を使ったかを申告する。** **倒れる向き**: 応答本文の手順表は transcript のタスク一覧を読むチェーン検知（Stop hook）を発火させないため、**登録を飛ばしても機械段では気づかれない（fail-open）**。（規範 `orchestration-discipline` の C2 と同じ規律。）

```markdown
## 実装計画

### 変更ファイル
- [ ] `bin/app.ts` - スタックエントリーポイント
- [ ] `lib/{stack-name}-stack.ts` - スタック定義
- [ ] `lib/constructs/{construct-name}.ts` - コンストラクト実装

### 確認事項
- [ ] L2/L3 コンストラクト選択の根拠確認
- [ ] Props interface 設計（Required vs Optional）
- [ ] スタック間 cross-stack references
- [ ] 環境別設定の注入方法
```

### ステップ 3: 実装

パターンを参照して実装:

- L2/L3 コンストラクトの使い分け: [reference/patterns/cdk-constructs.md](reference/patterns/cdk-constructs.md)
- 環境別変数管理: [reference/patterns/environment-config.md](reference/patterns/environment-config.md)
- ガバナンス（タグ付け・暗号化強制）: [reference/patterns/cdk-aspects.md](reference/patterns/cdk-aspects.md)

マルチスタック構成: [reference/templates/stack-structure.ts.template](reference/templates/stack-structure.ts.template)

CI/CD 連携: [reference/templates/github-actions-cdk.yml.template](reference/templates/github-actions-cdk.yml.template)

**テンプレートのプレースホルダ置換（必須）**:

テンプレートは `{...}` のプレースホルダを含み、**そのままでは動かない**。ヘッダコメントの Placeholders 節を正本として全件置換する（`{ORG}` / `{REPO}` / `{ACCOUNT_ID}` / `{ROLE_NAME}` / `{MAIN_BRANCH}` / `{DEV_BRANCH}`）。

- `{MAIN_BRANCH}` は **このリポジトリの mainline ブランチ名**。決め打ちせず実測する:

  ```bash
  gh repo view --json defaultBranchRef -q .defaultBranchRef.name
  ```

  IAM 信頼ポリシーの `sub` 条件・`on.push.branches` / `on.pull_request.branches`・`deploy-staging` / `deploy-prod` の `if:` の 3 箇所に出るので、まとめて置換する。**`sub` 条件は IAM の文字列で GitHub Actions の式が評価されない**ので必ず literal を書く。

- `{DEV_BRANCH}` は **dev 環境へデプロイする開発ブランチ名**。`sub` 条件の列挙・`on.*.branches`・`diff` / `deploy-dev` の `if:` に出る。
  - **`{MAIN_BRANCH}` と必ず異なる名前**にする。同名だと 1 回の push で `deploy-dev` / `deploy-staging` / `deploy-prod` が同時に発火し、**本番まで巻き込む**。mainline が `develop` のリポジトリで起きやすい。
  - **dev 用ブランチが無いなら別名に置換せず dev 経路を削除する**。次の 6 つを漏らさない:
    1. `on.*.branches` の `'{DEV_BRANCH}'` 行
    2. `deploy-dev` job 全体
    3. `diff` job の `if:` から `|| github.ref == 'refs/heads/{DEV_BRANCH}'`
    4. 信頼ポリシー `sub` 配列の `{DEV_BRANCH}` 要素 — **直前行の末尾カンマも一緒に消す**（行だけ消すとカンマが孤立して JSON invalid になり AWS に拒否される）。要素が 1 つだけになるなら単一文字列に戻してもよい
    5. 残った `needs: deploy-dev`
    6. ヘッダの `{DEV_BRANCH}` 解説ブロック — **落とすと下の `grep` 検査に残存 `{DEV_BRANCH}` が引っかかり続け、正しく削除した人ほど検査に落ちる**

- OIDC の `sub` 条件は**環境別ロール分離が第一推奨**。1 ロールを共有するなら `StringEquals` に対象ブランチを配列で列挙する。`refs/heads/*` のワイルドカードは、ブランチを push できる者全員が本番デプロイロールに到達できるため**非推奨**。

- 置換後に残っていないことを機械で確認する（0 件になること）:

  ```bash
  grep -rnE "\{[A-Z_]+\}" .github/workflows/
  ```

  ディレクトリ再帰にしてあるのは、ファイル名 / glob を直に指定すると対象が無いときに警告が出て終了コードが 2 になり、「出力が空＝クリーン」と読み違えやすいため。

**⚠️ 「緑だから置換済み」とは言えない**: 未置換の影響は箇所によって違う。

| 未置換の箇所 | 起きること | 気づけるか |
|---|---|---|
| `{MAIN_BRANCH}` / `{DEV_BRANCH}` が `on.*.branches` に残る | 実在しないブランチ名として扱われ、workflow が一切トリガーしない | **沈黙**（赤くならない） |
| `{MAIN_BRANCH}` / `{DEV_BRANCH}` が job の `if:` に残る | 条件が真にならず job が skip される・チェックは緑 | **沈黙**（赤くならない） |
| `{ORG}` / `{REPO}` / ブランチ名を IAM 信頼ポリシーの `sub` へそのまま転記 | AssumeRole が拒否される | **workflow がトリガーされれば**赤くなる（ステップ実行時） |
| `{ACCOUNT_ID}` / `{ROLE_NAME}` を `CDK_DEPLOY_ROLE_ARN` secret へそのまま転記 | ARN が不正で `configure-aws-credentials` が失敗 | **workflow がトリガーされれば**赤くなる（ステップ実行時） |

> `{ORG}` / `{REPO}` / `{ACCOUNT_ID}` / `{ROLE_NAME}` はテンプレート本体ではコメント（IAM 設定のサンプル）にしか現れない。害が出るのは、その値を **IAM ロールや GitHub secret へ転記したとき**。

**「赤くなる」側には成立条件がある——workflow がトリガーされること。** 最も普通の失敗（テンプレートをコピーして何も置換しない）では `on.*.branches` も未置換なのでイベントが 1 つもマッチせず、赤が出る前に沈黙する側へ倒れうる。したがって逆向きの推論（「赤い＝置換漏れではない」「緑＝置換済み」）はどちらも成り立たない。

> 上表の「ステップ実行時に赤」は、YAML パースまでを実測した上での**推論**であって GitHub Actions 上で実走検証したものではない。配置後に必ず 1 度 mainline へ変更を反映（PR を merge）し、該当 job の run が実際に作られたことを確認すること。

**実装チェック**:
- `interface Props` を Stack/Construct ごとに定義し、型安全性を確保
- 環境変数・シークレットは SSM / Secrets Manager 経由で注入
- スタック間依存は `cdk.Fn.importValue` または Props 経由で解決

### ステップ 4: 検証

```bash
# 型チェック
cd {infra-dir} && npx tsc --noEmit

# テンプレート生成（構文検証）
npx cdk synth

# 差分確認（デプロイ前）
npx cdk diff

# スナップショットテスト（存在する場合）
npm test
```

### ステップ 5: 完了レポート

変更内容をコメントとして Issue に記録する。

## リファレンスドキュメント

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/patterns/cdk-constructs.md](reference/patterns/cdk-constructs.md) | L2/L3 コンストラクト使い分け・Props 設計・合成パターン | コンストラクト実装時 |
| [reference/patterns/environment-config.md](reference/patterns/environment-config.md) | 環境別設定管理（cdk.json / Props / SSM）| 環境別スタック分離時 |
| [reference/patterns/cdk-aspects.md](reference/patterns/cdk-aspects.md) | Aspects によるタグ付け・暗号化・コスト管理ガバナンス | ガバナンス要件実装時 |
| [reference/templates/stack-structure.ts.template](reference/templates/stack-structure.ts.template) | Network/Stateful/Stateless 3スタック分割テンプレート | スタック設計時 |
| [reference/templates/github-actions-cdk.yml.template](reference/templates/github-actions-cdk.yml.template) | OIDC 認証・cdk diff/deploy ワークフロー | CI/CD 設定時 |

## クイックコマンド

```bash
npx cdk list                          # スタック一覧
npx cdk synth                         # CloudFormation テンプレート生成
npx cdk diff [stack-name]             # 現在のデプロイとの差分
npx cdk deploy [stack-name]           # デプロイ（手動確認あり）
npx cdk deploy --require-approval never  # 自動承認デプロイ（CI/CD 向け）
npx cdk destroy [stack-name]          # スタック削除
npx cdk bootstrap                     # CDK ブートストラップ（初回のみ）
npx tsc --noEmit                      # 型チェック（デプロイ前に必ず実行）
```

## 次のステップ

`implement-flow` チェーンではなくスタンドアロンで起動された場合:

```
実装完了。次のステップ:
→ `implement-flow` の手順でコミットへ進む（コミットは `commit-worker` が行う）
```

## 注意事項

- **設計判断には踏み込まない** — リソース選定・L2/L3 選択の変更が必要な場合は `designing-aws` に差し戻す
- **`cdk synth` を必ず実行** — デプロイ前にテンプレート生成で構文エラーを検出する
- **L1 コンストラクトは最終手段** — L2 の `addPropertyOverride` や escape hatch で解決できないか先に検討する
- **シークレットをコードに埋め込まない** — パスワード・API キーは必ず SSM Parameter Store / Secrets Manager 経由
- **スタック分割を維持** — Network / Stateful / Stateless の分割原則を崩さない
- **`any` 型を避ける** — Props interface を適切に定義し型安全性を確保する
