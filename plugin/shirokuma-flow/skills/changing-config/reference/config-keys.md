# config-keys（`.shirokuma/config.yaml` のキー）

キーの一覧（型・未設定時・値域・倒れる向き・意味・印）は `shirokuma-flow config keys` を引く（1 キーなら `shirokuma-flow config keys <key>`）。印と倒れる向きの意味は同じ出力の `legend` にある。

- `settable: false` のキー（型が `map`）と一覧に無いキーは `config set` で書けない（人が手で編集する）。`unsettable: false` のキー（必須キー）は `config unset` で消せない。
- 印が `authorization` か `scope` のキーを変えるのはこのスキルを通すときだけ（SKILL.md の手順）。印が `check` のキーを変えた PR も、授権キーと同じく merge を人に渡す。
- `config get <key>` は値域検査を持つキーで値域外の値を返さず失敗する（`reason: invalid-value`）。
