# @shirokuma-library/lint

AI ファースト開発ワークフロー向けのファイルレベル lint チェックライブラリ。

## 機能

- **coverage**: 実装ファイルとテストファイルの対応チェック
- **docs**: Markdown ドキュメントの構造（セクション / 長さ / frontmatter / 内部リンク）検証
- **structure**: プロジェクト構造（必須 / 推奨ディレクトリ / 必須ファイル）検証
- **code**: TypeScript コードの JSDoc タグ必須性検証
- **commit-format**: commit メッセージの Conventional Commits 準拠チェック

## インストール

```bash
pnpm add @shirokuma-library/lint
```

## CLI 使用方法

```bash
# 全チェック実行
shirokuma-lint all --project .

# カバレッジチェック
shirokuma-lint coverage --project .

# Docs チェック
shirokuma-lint docs --config-file .shirokuma/lint/docs.yaml

# 構造チェック
shirokuma-lint structure --config-file .shirokuma/lint/structure.yaml

# コードチェック
shirokuma-lint code --config-file .shirokuma/lint/code.yaml

# コミットフォーマットチェック
shirokuma-lint commit-format --config-file .shirokuma/lint/commit-format.yaml
```

## API 使用方法

```typescript
import { lintCoverage, lintDocs, lintStructure, lintCode, lintCommitFormat } from '@shirokuma-library/lint';

const report = lintCoverage({ projectPath: '.' });
console.log(report.passed);
```
