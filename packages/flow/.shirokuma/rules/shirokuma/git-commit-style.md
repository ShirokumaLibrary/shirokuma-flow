---
scope: default
category: general
priority: required
---

# Git コミットスタイル

## コミットメッセージ形式

```
{type}: {description} (#{issue-number})

{optional body}
```

## Conventional Commit タイプ

| タイプ | 使用タイミング |
|--------|-------------|
| `feat` | 新機能・機能拡張 |
| `fix` | バグ修正 |
| `refactor` | コード構造改善（動作変更なし） |
| `docs` | ドキュメントのみの変更 |
| `test` | テストの追加・更新 |
| `chore` | 設定・ツール・依存関係 |

## ルール

1. **1行目は72文字以内**
2. **Issue 番号を参照** する（該当する場合）: `(#39)`
3. **命令形** で記述: "add feature"（"added feature" ではない）
4. **本文は任意** — 説明が必要な複雑な変更に使用
5. **件名と本文の間に空行** を入れる

## 例

```
feat: ブランチワークフロールール追加 (#39)

fix: クロスリポ対応のためリポ名を getProjectId に渡す (#34)

refactor: マーケットプレイスとプラグインのディレクトリ構造を分離 (#27)

chore: 依存関係を更新
```

## コード言語

| 要素 | 言語 |
|------|------|
| コード / 変数名 | English |
| コメント / JSDoc | 日本語 |
| コミットメッセージ | 日本語（プレフィックスは English: `feat:`, `fix:` 等） |
| CLI 出力 | i18n 辞書 (`i18n/cli/`) |

## 禁止事項

- プロジェクトで必要とされない限り `Signed-off-by` 行を含めない
- `--no-verify` でフックを回避しない
- 明示的な依頼なしに amend しない
- ベースブランチに force push しない
