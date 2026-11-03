# 推奨技術スタック

アプリ層（Next.js）の推奨技術スタック。**「上書き可能な既定の出発点」**であり、固定強制ではない。

`shirokuma-nextjs` はコア shirokuma-flow の opt-in 拡張であり、**framework 非依存**のスタンスを保つ。本スタックは「framework を固定しない」方針と矛盾しない——プロジェクトが別の選定をするなら、この出発点を差し替えてよい。何も選ばないプロジェクトに対して、毎回ゼロから議論せず立ち上がれる既定値を提供することが目的である。

## 選定表

| 領域 | 採用 | バージョン方針 | 裏付け | 理由 |
|------|------|--------------|------|------|
| Next.js | 16 | 作成時点はメジャー 16・マイナー/パッチは追従させる（新しいメジャーの扱いは下の「推奨版と確かめ方」節） | 下の「推奨版と確かめ方」節 | — |
| TypeScript | 6 | メジャー 6 固定 | 実際の使用で裏付けあり | — |
| Vitest | 4 | メジャー 4 | 実際の使用で裏付けあり | — |
| Tailwind CSS | v4 | 現行メジャー・CSS-first | 使用実績の裏付けなし。陳腐化しやすい | shadcn の前提依存 |
| shadcn/ui | Tailwind v4 対応版 | — | 使用実績の裏付けなし。陳腐化しやすい | copy-in 方式でロックインしない＝「上書き可能」と整合 |

裏付けのない行は、採用前に現行版の公式ドキュメントで方針が変わっていないかを確かめる。

## 推奨版と確かめ方

各スタックは 1 系列だけを推奨する。下表はプラグイン作成時点（2026-10）の推奨で、設定時は次を打ち、返った最新版・導入先の版・既知の脆弱性で版を決める（`versions` はコア CLI の verb で、拡張パッケージは要らない。打つ場所はリポ直下でよく、npm / pnpm の workspaces は各パッケージまで読む）。

```bash
shirokuma-flow versions --npm next react typescript vitest tailwindcss eslint eslint-config-next --node-lts
```

- **読み方**: 各要素の `latest` が推奨する版、`current` が導入先の版、`vulnerabilities` が導入済みの版の既知の脆弱性。`verified` が `false` なら、`unverified` の要素（`current` が `unreadable` の要素を含む）は確かめられていない（問題なしではない）ので、下表の確かめる先を読むか人に伝える。
- **新しいメジャー**: `latest` が下表より新しいメジャーを返したら、新しく作るプロジェクトはそのメジャーを採る。既存の導入先ではメジャーの移行として人に確かめる。
- **コマンドが無い・失敗した回**（`versions` を持たない古い CLI・ネットワークが無い環境）: 全要素を未確認として扱い、下表の確かめる先とともに人に伝える。下表の値で確かめたことにしない。
- **最低版**: Next.js の行の最低版はセキュリティ告知による下限で、CLI の結果によらず満たす（告知で上がりうるので、`vulnerabilities` が空でないときは告知の置き場で確かめる）。

| 対象 | 作成時点の推奨 | 確かめる先 |
|------|------------|----------|
| Next.js | 16 系（16.4.1 以上。それより前の 16 系にはセキュリティ告知の脆弱性が残る） | https://nextjs.org/blog ・ https://github.com/vercel/next.js/releases ・ https://github.com/vercel/next.js/security/advisories |
| TypeScript | 6 系 | https://github.com/microsoft/TypeScript/releases |
| Vitest | 4 系 | https://github.com/vitest-dev/vitest/releases |
| Tailwind CSS | v4 系 | https://github.com/tailwindlabs/tailwindcss/releases |
| shadcn/ui | Tailwind v4 対応版 | https://ui.shadcn.com/docs/changelog |
| ESLint | 最新版 | https://github.com/eslint/eslint/releases |
| Node.js | LTS 系列を使う | https://nodejs.org/en/about/previous-releases |

## cdk-nextjs をデプロイ先にする場合の互換メモ

本番 AWS デプロイに cdk-nextjs を採用する場合のみ、Next.js アプリ側に以下の互換設定が要る。cdk-nextjs 採用時の暫定的な互換メモ（実際のデプロイで裏付けていない）であり、デプロイ先の選定を強制するものではない（cdk-nextjs を使わない場合はこの節は適用されず、上の選定表だけで足りる）。

- **next.config に `adapterPath` を追加**: `adapterPath: import.meta.resolve("cdk-nextjs/adapter")` を設定する。cdk-nextjs は Next.js の公開 adapter API を使うため、この解決パスをアプリ側で指す。
- **版の要件**: Next.js は **16.2 系以降**（cdk-nextjs が Image Optimization Caching の公開 adapter API に依存する）・Node は **v24**・Docker が必須。セキュリティ上の安全な版（16.4.1 以上）は上の「推奨版と確かめ方」節で別に確かめる。
- **`output: "standalone"` は使わない**: cdk-nextjs は Next.js を black box として扱い、standalone 出力前提とは同時に成立しない。**汎用コンテナ経路**（cdk-nextjs をデプロイ先にしない構成）向けの standalone 設定は、cdk-nextjs 経路では外す。語の定義は `shirokuma-infra` の designing-aws reference `nextjs-deploy.md`「2 つのコンテナ経路」節にある。

本番 AWS デプロイ側の construct 選定・キャッシュ層・コスト等の詳細は `shirokuma-infra` の designing-aws reference（`nextjs-deploy.md`）を参照する。

## 上書き方針

なぜ固定強制でないか:

- shirokuma-nextjs は framework 非依存のコンパニオンであり、特定スタックを利用者に強制しない。本スタックは「何も選ばないプロジェクトの出発点」であって、選定済みプロジェクトの決定を上書きするものではない。
- 各領域は独立に差し替え可能。例えばテストランナーを別物にしても、TypeScript 6 の方針は維持できる。
- **shadcn/ui は copy-in 方式**（コンポーネントをプロジェクト内にコピーして持つ）であり、ライブラリ依存としてロックインしない。採用後の改変・撤去が容易で、「上書き可能な既定」という位置づけと整合する。

## 陳腐化対策

- **導入先ではメジャーを固定し、新しいメジャーは見直しの回に移す**: 導入先の各領域はメジャーで固定し（マイナー/パッチはフロート可）、配布元の最新が新しいメジャーになったら、見直しの回にメジャーの移行として人に確かめる。新しく作るプロジェクトは「推奨版と確かめ方」節の手順で最新を採る。

## 関連

- **インフラ層の対称物**: `shirokuma-infra` が提供するインフラ層 reference（ローカル開発インフラの命名規則・サービス選定基準）と対称の位置づけ。インフラ層 reference は `shirokuma-infra` を参照。
- **scaffold 連携**: `setting-up-nextjs` が本スタックを参照し、開発環境ベースを bootstrap する。
