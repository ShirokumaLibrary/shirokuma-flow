# permission-deny（`.shirokuma/config.yaml` と `.shirokuma/dist/` の書き換えを止める設定例）

導入先が任意で置く設定。置かなくても `changing-config` の手順は変わらない。

## 設定例

`.claude/settings.json` の `permissions.deny` に置く。

```json
{
  "permissions": {
    "deny": ["Edit(/.shirokuma/config.yaml)", "Edit(/.shirokuma/dist/**)"]
  }
}
```

- **`Edit(/.shirokuma/config.yaml)`**: 設定ファイルの値は `shirokuma-flow config set` / `config unset` で変える前提で、AI の編集ツールによるうっかりした書き換えを止める。
- **`Edit(/.shirokuma/dist/**)`**: `.shirokuma/dist/` は配布物の置き場で、書くのは CLI の `update` / `rules install` だけ。編集ツールで直接書き換えると、次の `update` で黙って消える。規範を足す・変えるなら、書くべき置き場は導入先の `.shirokuma/rules/`。置き場の下が増えても効くよう `dist/**` にする。

- **`Edit(...)` の 1 つで足りる**: Claude Code の `Edit` の規則は、ファイルを書く組み込みツール（Edit・Write・NotebookEdit など）すべてに掛かる。`Write(...)` を書いても参照されず、起動時に警告が出る。素の `"Write"`（パスなし）はツールそのものを使えなくするので置かない。
- **パスの書き方**: `/` 始まりは設定ファイルの置き場所を基準にする（プロジェクトの `.claude/settings.json` ならセッションの作業ディレクトリ）。ファイルシステムの根ではない。素のパス（`.shirokuma/config.yaml`）は現在のディレクトリ基準で、サブディレクトリから始めたセッションでは当たらないことがある。
- **置いたら確かめる**: 書き方を誤った規則は、その項目だけが読み飛ばされ、ファイルの他の設定は効いたまま残る（deny が黙って効かない）。新しいセッションで ①Edit ツールと Write ツールで `.shirokuma/config.yaml` を書こうとして拒否される、同じく `.shirokuma/dist/` 配下のファイルを書こうとして拒否される ②`/permissions` に規則が警告なしで載っている、の 2 つを確かめる。
- 確かめた範囲: Claude Code の公式ドキュメント（permissions と settings の頁）の記述。版によって変わりうるので、使っている版で上の 2 つを確かめる。

## 限界

- **Bash のうち、ファイルを名指すコマンドは止まり、自分でファイルを開くプロセスは止まらない**: Claude Code が見分けるファイル操作のコマンド（`sed`・`tee` など）とリダイレクト（`> file`）の対象にも `Edit` の deny が掛かる。スクリプト（`python`・`node` など）がファイルを開いて書く形は止まらない。
- **`shirokuma-flow config set` / `config unset` は止まらない**——CLI のプロセスが自分でファイルを書くので、この deny の外にある。設定スキルはこの経路で書き換える。同じく `shirokuma-flow update` / `rules install` は `.shirokuma/dist/` を書けるまま残る（それが正しい経路）。
- **人のエディタでの編集は止まらない**。
- 倒れる向きは fail-open。止めるのは AI の編集ツールによるうっかりした書き換えで、意図した迂回は止めない。全プロセスを止めるには OS レベルのサンドボックスが要る。
