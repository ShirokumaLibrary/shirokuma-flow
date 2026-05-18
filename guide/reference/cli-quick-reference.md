# CLI クイックリファレンス

shirokuma-flow の全コマンドを一覧する。各コマンドの詳細オプションは `<command> --help` で確認できる。

> ユーザーは通常 CLI を直接使わない。Claude Code に指示を出すと、AI が内部でこれらのコマンドを実行する。AI への指示方法は[ワークフローガイド](../workflows/README.md)を参照。

## バイナリ構成

shirokuma-flow は複数のバイナリに分かれている。インストール対象（`install.sh` / `npm i -g @shirokuma-library/shirokuma-flow`）は `shirokuma-flow` のみで、生成系・lint 系のサブパッケージは個別に追加する。

| バイナリ | パッケージ | 役割 |
|---------|-----------|------|
| `shirokuma-flow` | `@shirokuma-library/shirokuma-flow` | GitHub Issues / PR / Discussions / Projects 管理、init、update、sync-github |
| `shirokuma-portal` | `@shirokuma-library/portal` | ドキュメント生成（typedoc, schema, deps, portal, ...） |
| `shirokuma-lint` | `@shirokuma-library/lint` | コード・ドキュメント・テストの構造 lint |
| `shirokuma-md` | `@shirokuma-library/markdown` | LLM 最適化 Markdown 結合・lint |
| `shirokuma-codemap` | `@shirokuma-library/codemap` | コードマップ抽出（AI 用システム概要） |
| `shirokuma-context` | `@shirokuma-library/context` | 外部ドキュメント（llms.txt / GitHub）のローカル取得 |

以下のコマンド表は対応するバイナリ名を明示する。

---

## `shirokuma-flow` — GitHub ワークフロー管理

### issue — Issue / 関連オペレーション

```bash
shirokuma-flow issue list                                # Issue 一覧（Projects フィールド付き）
shirokuma-flow issue list --status "In progress"         # ステータスでフィルタ
shirokuma-flow issue pull 42                             # Issue / Discussion 本体 + コメントをキャッシュ
shirokuma-flow issue add /tmp/shirokuma-flow/new-issue.md   # Issue を作成（frontmatter 解釈）
shirokuma-flow issue update 42 [body-file]               # 本文・メタデータを 1 コマンドで更新（pull→edit→push の置換）
shirokuma-flow issue push 42                             # キャッシュの変更をリモートに送信
shirokuma-flow issue comment 42 /tmp/shirokuma-flow/comment.md  # コメント追加
shirokuma-flow issue comments 42                         # コメント一覧
shirokuma-flow issue close 42                            # クローズ
shirokuma-flow issue cancel 42                           # NOT_PLANNED でクローズ
shirokuma-flow issue reopen 42                           # 再オープン
shirokuma-flow issue check                               # キャッシュとリモートの差分（全件 / 指定番号）
shirokuma-flow issue search "キーワード"                 # Issue / PR / Discussion 横断検索（--type で絞込）
shirokuma-flow issue context 42                          # Issue / PR を起点に関連情報を一括取得してキャッシュ
shirokuma-flow issue branch 42                           # Issue 起点のフィーチャーブランチを作成（命名・ベース自動）
shirokuma-flow issue link 42 --discussion 30             # Issue ⇄ Discussion をリンク
shirokuma-flow issue rollback 42 --mode cancel           # キャンセル / ToDo 戻し / マージ revert
shirokuma-flow issue template plan                       # テンプレート骨格を生成（issue, plan, pr, adr, comment）
shirokuma-flow issue import                              # 公開リポジトリから Issue をインポート
```

サブ Issue 操作:

```bash
shirokuma-flow issue parent 42 100                       # サブ Issue として親に紐付け
shirokuma-flow issue unparent 42                         # 親紐付けを解除
shirokuma-flow issue sub-list 100                        # 親 Issue のサブ Issue 一覧
shirokuma-flow issue assign 42 @me                       # 担当者を追加
shirokuma-flow issue unassign 42 @me                     # 担当者を解除
shirokuma-flow issue fields                              # プロジェクトフィールド定義を表示
```

### pr — Pull Request 管理

```bash
shirokuma-flow pr create [42]                            # PR 作成（Issue 番号で自動判定）
shirokuma-flow pr list
shirokuma-flow pr show 15
shirokuma-flow pr comments 15                            # レビュースレッド一覧
shirokuma-flow pr reply 15 --reply-to <id> reply.md
shirokuma-flow pr resolve 15 --thread-id PRRT_xxx
shirokuma-flow pr edit 15 --base develop --title "..."
shirokuma-flow pr merge 15                               # マージ（hooks で人間の承認を必須化）
shirokuma-flow pr close 15                               # マージせずクローズ
```

### discussion — Discussions / ADR 管理

```bash
shirokuma-flow discussion list --category Knowledge
shirokuma-flow discussion show 30
shirokuma-flow discussion search "キーワード"
shirokuma-flow discussion add body.md             # frontmatter から title / category 解釈
shirokuma-flow discussion categories                     # 利用可能なカテゴリ一覧
shirokuma-flow discussion templates generate             # Discussion テンプレート生成
shirokuma-flow discussion adr create "タイトル"          # ADR 作成
shirokuma-flow discussion adr list
shirokuma-flow discussion adr get 1592
```

### project — GitHub Projects V2 管理

```bash
shirokuma-flow project list                              # プロジェクトアイテム一覧（Done を除外）
shirokuma-flow project get 42                            # ID または Issue 番号で詳細
shirokuma-flow project fields                            # 利用可能なフィールド定義
shirokuma-flow project create --title "Project Name"     # ドラフト Issue を作成
shirokuma-flow project update 42 --status "Review"
shirokuma-flow project add-issue 42                      # 既存 Issue をプロジェクトに追加
shirokuma-flow project workflows                         # ビルトイン自動化ワークフロー状態
shirokuma-flow project setup --lang ja                   # Status / Priority / Size フィールドをセットアップ
shirokuma-flow project setup-metrics                     # メトリクス追跡用 Text フィールドを作成
```

### status — Issue ステータス管理

```bash
shirokuma-flow status get 42                             # 現在ステータス + 遷移可能ステータス
shirokuma-flow status allowed 42                         # 遷移可能ステータス（番号 or --status）
shirokuma-flow status history 42                         # Status 変更履歴（Projects V2）
shirokuma-flow status transition 42 --to "Review"        # 検証付き遷移
shirokuma-flow status approve 42                         # Review → Done（Issue は Close しない）
shirokuma-flow status update-batch --review 42 --done 43 # 一括更新
```

### checkpoint — 作業フェーズ移行を 1 コマンドに集約

```bash
shirokuma-flow begin 42                                  # 作業開始（status: In progress + 自己アサイン）
shirokuma-flow submit 42 --comment summary.md            # レビュー提出（status: Review、コメント任意）
shirokuma-flow submit 42 --via "In progress"             # 中間ステータスを経由
shirokuma-flow block 42 --reason "API 仕様確定待ち"      # ブロック宣言（理由はコメント化）
shirokuma-flow resume 42                                 # ブロック解除して In progress へ
```

`begin/submit/block/resume` は `status transition` + `issue assign` + `issue comment` の組み合わせを 1 コマンドにまとめる。日常はこちらを優先する。

### dashboard / preflight / integrity — 横断ユーティリティ

```bash
shirokuma-flow dashboard                                 # アクティブ Issue + PR + git 状態
shirokuma-flow dashboard --team                          # 担当者別ダッシュボード
shirokuma-flow preflight                                 # セッション終了前に必要なデータを一括取得
shirokuma-flow integrity                                 # Issue 状態と Project Status の整合性チェック
shirokuma-flow integrity --fix                           # 不整合を自動修正
shirokuma-flow integrity --setup                         # GitHub 手動設定（Issue Types / カテゴリ）の検証
```

### repo — リポジトリ情報・ペア

```bash
shirokuma-flow repo info                                 # リポジトリ情報
shirokuma-flow repo labels                               # ラベル一覧
shirokuma-flow repo pairs list                           # Public/Private リポジトリペア一覧
shirokuma-flow repo pairs release main --tag v1.0.0      # 公開リポジトリへのリリース
```

### git — ローカル git 状態

```bash
shirokuma-flow git check                                 # branch / status / log / diff を一括取得
shirokuma-flow git commit-push --message "..."           # add + commit + push を 1 操作
```

### init / update — セットアップと更新

```bash
shirokuma-flow init --with-skills --with-rules --lang ja             # 初期化（推奨）
shirokuma-flow init --nextjs --with-skills --with-rules              # Next.js モノレポスキャフォールド
shirokuma-flow init --with-nextjs --with-skills --with-rules         # shirokuma-nextjs プラグインを追加
shirokuma-flow init --channel rc                                     # プラグインリリースチャンネル指定
shirokuma-flow update                                                # CLI + スキル + ルールを更新（--sync はデフォルト有効）
shirokuma-flow update --sync --with-rules                            # 詳細オプション付き更新
shirokuma-flow plugin-install-local                                  # ローカル plugin/ をグローバルキャッシュへ
shirokuma-flow plugin-install-local --cleanup-rules                  # 管理外ルール（過去 plugin リリースの orphan）も削除（switch-plugin.sh dev 経由）
```

### スキル管理

```bash
shirokuma-flow skills routing coding                     # コーディング用スキル一覧
shirokuma-flow skills routing designing
shirokuma-flow skills routing reviewing
shirokuma-flow rules inject                              # スコープ別にルールを stdout に注入
shirokuma-flow skill validate <skill-path>               # フロントマター検証
shirokuma-flow skill package <skill-path>                # .skill ファイル化
shirokuma-flow skill eval <skill-path>                   # トリガー eval
shirokuma-flow skill optimize <skill-path>               # eval + 改善ループ
shirokuma-flow skill benchmark <benchmark-dir>           # benchmark 集計
```

### hooks

```bash
shirokuma-flow hooks evaluate                            # hooks 評価（PreToolUse 用）
shirokuma-flow hooks evaluate-stop
shirokuma-flow hooks evaluate-subagent-stop
```

### sync-github — GitHub データ取得

```bash
shirokuma-flow sync-github                               # GitHub Issues/Discussions を JSON で出力
```

> その他のドキュメント生成は `shirokuma-portal` バイナリ。

### lint（互換用）

`shirokuma-flow lint` は `shirokuma-lint` の薄いラッパー。CI などで分けたい場合は `shirokuma-lint` を直接使う。

```bash
shirokuma-flow lint all -p .
shirokuma-flow lint tests
shirokuma-flow lint coverage
shirokuma-flow lint docs
shirokuma-flow lint code
shirokuma-flow lint annotations
shirokuma-flow lint structure
shirokuma-flow lint workflow
shirokuma-flow lint security
```

---

## `shirokuma-portal` — ドキュメント生成

```bash
shirokuma-portal generate                                # 設定で有効な全コマンド
shirokuma-portal generate typedoc -p .                   # TypeDoc API ドキュメント
shirokuma-portal generate schema -p .                    # Drizzle ORM → DBML / SVG ER 図
shirokuma-portal generate deps -p .                      # 依存関係グラフ
shirokuma-portal generate test-cases -p .                # テストケース一覧
shirokuma-portal generate coverage -p .                  # テストカバレッジ
shirokuma-portal generate feature-map -p .               # 機能階層マップ
shirokuma-portal generate portal -p .                    # ポータル HTML
shirokuma-portal generate overview -p .                  # プロジェクト概要
shirokuma-portal generate screenshots                    # Playwright スクリーンショット
shirokuma-portal generate search-index                   # 全文検索インデックス
shirokuma-portal generate link-docs                      # API ⇄ テストの双方向リンク
shirokuma-portal generate details                        # 各要素の詳細ページ
shirokuma-portal generate impact -t "TargetName"         # 変更影響分析
shirokuma-portal generate api-tools                      # MCP ツールドキュメント
shirokuma-portal generate i18n                           # i18n 翻訳ドキュメント
shirokuma-portal generate packages                       # モノレポ共有パッケージ
```

---

## `shirokuma-lint` — 構造 lint

```bash
shirokuma-lint all                                       # coverage + structure（+ docs/code/commit-format は config 指定時）
shirokuma-lint coverage                                  # 実装ファイル ↔ テストファイル対応
shirokuma-lint docs                                      # Markdown 構造（セクション / 長さ / frontmatter / 内部リンク）
shirokuma-lint code                                      # JSDoc タグ必須性
shirokuma-lint structure                                 # 必須 / 推奨ディレクトリ・必須ファイル
shirokuma-lint commit-format                             # Conventional Commits 形式
shirokuma-lint all --strict                              # error が 1 件でもあれば exit 1
```

> `tests` / `annotations` / `workflow` / `security` は `shirokuma-flow lint <type>` 経由で利用する（フロー側ラッパーが扱う）。

---

## `shirokuma-md` — LLM 最適化 Markdown

```bash
shirokuma-md md build                                    # Markdown 結合ビルド
shirokuma-md md lint --fix                               # Markdown lint（自動修正）
shirokuma-md md validate
shirokuma-md md analyze
shirokuma-md md list
shirokuma-md md extract <file>
shirokuma-md md batch-extract
```

設定ファイルは別ファイル `shirokuma-md.config.yaml`。詳細は `shirokuma-md md --help`。

---

## `shirokuma-context` — 外部ドキュメントのローカル取得

```bash
shirokuma-context detect                                 # package.json から取得対象を逆引き
shirokuma-context fetch                                  # 全プリセット
shirokuma-context fetch nextjs-15                        # 指定プリセット
shirokuma-context list                                   # 取得済みソース
shirokuma-context search "キーワード"                    # ローカル横断検索
shirokuma-context search "..." --section                 # セクション単位
shirokuma-context remove <name>
shirokuma-context manifest                               # MANIFEST.md 再生成
```

---

## `shirokuma-codemap` — コードマップ抽出

```bash
shirokuma-codemap build                                  # コードマップ（main index + JIT bodies）を生成
```

---

## 共通オプション

| オプション | バイナリ | 説明 |
|-----------|---------|------|
| `-p, --project <path>` | flow / portal / lint / codemap / context | プロジェクトパス（既定: cwd） |
| `-c, --config <file>` | flow / portal | 設定ファイルパス |
| `-o, --output <dir>` | flow / portal | 出力ディレクトリ |
| `-v, --verbose` | flow | 詳細ログ |
| `-s, --strict` | flow lint / lint | エラーで終了コード 1 |
| `--locale <en\|ja>` | flow / portal | CLI 出力言語 |
| `--no-color` / `--color` | flow / portal | 色出力 |
| `--help` | 全バイナリ | AI 向け JSON ヘルプ（既定） |
| `--help-human, -H` | 全バイナリ | 人間向けテキストヘルプ |
| `<binary> describe` | 全バイナリ | コマンドツリー全体を JSON でダンプ（AI ディスカバリー） |
| `--owner <owner>` | flow（GitHub 系） | リポジトリオーナー |
| `--public` | flow（GitHub 系） | repoPairs の公開側を対象 |
| `--repo <alias>` | flow（GitHub 系） | crossRepos のエイリアス |

## 関連ドキュメント

- [ワークフローガイド](../workflows/README.md) — AI への指示方法
- [設定ファイルリファレンス](../config.md) — `.shirokuma/config.yaml` の全設定項目
- [プラグイン管理](../plugins.md) — スキル・ルールのインストールと更新
