# worker を使えない回の確認ビュー

Agent ツールが無い・`explainer-worker` が agent の一覧に無い・worker が起動しなかったか起動がエラーで返った（hook が止めた・tools が解決しない）回に限り、skill `writing-html-explainer` を Skill ツールで直接起動し、記録行・生成・`pages push` を自分で行ってよい。worker が起動して値や止まる理由を返した回（パスが渡されていない・生成の根拠が無い・`pages push` が失敗した）と、遅い・手間・結果が不満な回は当たらない。

直接起動の回は、`explainer-worker` の定義の「制約」節と規範 `html-report-criteria` の確認ビューの記録行の節も Read し、次の項目を同じ形で守る: 記録行を対象の Issue / PR 本文の BLUF へ書いてから生成し、その後に `pages push` する順序・書き込みは対象の本文の記録行と確認ビューのパスだけ・対象の PR がまだ無い段は記録行を本文に書かない（PR を作るときの本文に書く）・URL を本文に書かない・生成の根拠（HTML 化判定）が無ければ作らない・`pages push` の返り値を検分し、失敗なら成功と書かない・作業ツリーの外に出ない。

「制約」節のうち worker とメインを分ける項（記録行は worker が書きメインは書かない・状態遷移をしない）はこの回に当てない——記録行はこのセッションの main が書き、状態遷移は skill `issue-run-flow` の「自分で打つもの・委任するもの」のとおり。規範 `html-report-criteria` と各 flow skill の「メインは本文も pages も書かない」は、この回については規範 `orchestration-discipline` C16 の作業セッションの例外が優先する。
