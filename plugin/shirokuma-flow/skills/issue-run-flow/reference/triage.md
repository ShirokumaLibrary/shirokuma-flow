# トリアージの段（課題自身が Backlog か Review で PR が無い回）

skill `issue-run-flow` の「始め方」の表が `gated` で PR の無い回にここへ来る。手順の正本は skill `issue-flow` の「課題本体の本文の書き手と、提出前の分析」節・「状態遷移（打ち方）」節・「確認ビュー」節で、段に入る直前に Read する（パスは `shirokuma-flow plugin skill-path issue-flow` の候補）。同 skill の「起動直後」の規範のうち、skill `issue-run-flow` の起動直後の注入で読んでいない名前は、`<rule-index>` の `file` から Read する。作業セッションで読むときに違う点だけを書く。

- 課題は既に在るので起票しない。本文は自分で書き（`requirements-worker` へ委任しない）、`issue context <課題#>` → 編集 → `issue push <課題#>` で書き戻す。題名を仕上げる回は `issue retitle <課題#>`、IssueType が課題本体の型（Feature / Bug / Task など）でない回は `issue retype <課題#>` を打つ。
- 提出前の分析（skill `analyze-issue`）は `review-worker` へ委任する（skill `issue-run-flow` の「自分で打つもの・委任するもの」のレビューに入る）。`review-worker` はブリーフで渡された SKILL.md の絶対パスしか読まないので、`shirokuma-flow plugin skill-path analyze-issue` の候補をブリーフに載せる。
- 短い経路を選ぶ回は、同じ skill の `reference/short-path.md` を Read する。
- 課題が ToDo になったら `shirokuma-flow next <課題>` を引き直し、skill `issue-run-flow` の「始め方」の表で行き先を決める。
