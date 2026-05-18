# shirokuma-flow テンプレート

## ファイル一覧

| ファイル | 説明 |
|----------|------|
| `dark-theme.css` | ダークテーマの共通 CSS |

## CSS カスタマイズ

`dark-theme.css` には以下の CSS 変数が定義されています。
設定ファイルやコマンドオプションでカスタマイズ可能です。

### 背景色

```css
--bg-color: #0a0a0a;      /* メイン背景 */
--card-bg: #141414;       /* カード背景 */
--code-bg: #1e1e1e;       /* コードブロック背景 */
```

### テキスト

```css
--text-primary: #fafafa;    /* メインテキスト */
--text-secondary: #a1a1aa;  /* セカンダリテキスト */
```

### アクセントカラー

```css
--accent-blue: #3b82f6;
--accent-green: #22c55e;
--accent-purple: #a855f7;
--accent-orange: #f97316;
--accent-pink: #ec4899;
```

## テンプレート構文

HTML テンプレートは Handlebars 形式をサポートしています。

### 変数展開

```handlebars
{{projectName}}
{{projectDescription}}
```

### 条件分岐

```handlebars
{{#if hasApi}}
  <a href="/api">API ドキュメント</a>
{{/if}}
```

### ループ

```handlebars
{{#each links}}
  <a href="{{url}}">{{name}}</a>
{{/each}}
```

## カスタムテンプレート

プロジェクト内に `docs/templates/` ディレクトリを作成し、
以下のファイルを配置することでカスタマイズできます。

- `portal.html` - ポータルページ
- `viewer.html` - ドキュメントビューア
- `test-cases.html` - テストケース一覧
