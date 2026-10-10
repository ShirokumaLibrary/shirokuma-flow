# 推奨技術スタック

アプリ層（Next.js）の推奨技術スタック。**「上書き可能な既定の出発点」**であり、固定強制ではない。

`shirokuma-nextjs` はコア shirokuma-flow の opt-in 拡張であり、**framework 非依存**のスタンスを保つ。本スタックは「framework を固定しない」方針と矛盾しない——プロジェクトが別の選定をするなら、この出発点を差し替えてよい。何も選ばないプロジェクトに対して、毎回ゼロから議論せず立ち上がれる既定値を提供することが目的である。

## 選定表

| 領域 | 採用 | バージョン方針 | 裏付け | 理由 |
|------|------|--------------|------|------|
| TypeScript | 6 | メジャー 6 固定（TS7 移行前提の踏み台） | 実際の使用で裏付けあり（6.0.3）。陳腐化しにくい | — |
| Vitest | 4 | メジャー 4 | 実際の使用で裏付けあり（4.1.9）。陳腐化しにくい | — |
| Tailwind CSS | v4 | 現行メジャー・CSS-first | 使用実績の裏付けなし。陳腐化しやすい | shadcn の前提依存 |
| shadcn/ui | Tailwind v4 対応版 | — | 使用実績の裏付けなし。陳腐化しやすい | copy-in 方式でロックインしない＝「上書き可能」と整合 |

裏付けのない行は、採用前に現行版の公式ドキュメントで方針が変わっていないかを確かめる。

## cdk-nextjs をデプロイ先にする場合の互換メモ

本番 AWS デプロイに cdk-nextjs を採用する場合のみ、Next.js アプリ側に以下の互換設定が要る。cdk-nextjs 採用時の暫定的な互換メモ（実際のデプロイで裏付けていない）であり、デプロイ先の選定を強制するものではない（cdk-nextjs を使わない場合はこの節は適用されず、上の選定表だけで足りる）。

- **next.config に `adapterPath` を追加**: `adapterPath: import.meta.resolve("cdk-nextjs/adapter")` を設定する。cdk-nextjs は Next.js の公開 adapter API を使うため、この解決パスをアプリ側で指す。
- **版下限**: Next.js は **v16.2 以上**（Image Optimization Caching の公開 adapter API に依存）・Node は **v24**・Docker が必須。上の選定表のバージョン方針とは独立に、cdk-nextjs 採用時のハード要件としてこの下限を満たす。
- **`output: "standalone"` は使わない**: cdk-nextjs は Next.js を black box として扱い、standalone 出力前提とは同時に成立しない。**汎用コンテナ経路**（cdk-nextjs をデプロイ先にしない構成）向けの standalone 設定は、cdk-nextjs 経路では外す。語の定義は `shirokuma-infra` の designing-aws reference `nextjs-deploy.md`「2 つのコンテナ経路」節にある。

本番 AWS デプロイ側の construct 選定・キャッシュ層・コスト等の詳細は `shirokuma-infra` の designing-aws reference（`nextjs-deploy.md`）を参照する。

## 上書き方針

なぜ固定強制でないか:

- shirokuma-nextjs は framework 非依存のコンパニオンであり、特定スタックを利用者に強制しない。本スタックは「何も選ばないプロジェクトの出発点」であって、選定済みプロジェクトの決定を上書きするものではない。
- 各領域は独立に差し替え可能。例えばテストランナーを別物にしても、TypeScript 6 の方針は維持できる。
- **shadcn/ui は copy-in 方式**（コンポーネントをプロジェクト内にコピーして持つ）であり、ライブラリ依存としてロックインしない。採用後の改変・撤去が容易で、「上書き可能な既定」という位置づけと整合する。

## 陳腐化対策

- **メジャーバージョン固定 + 定期見直し**: 各領域はメジャーで固定し（マイナー/パッチはフロート可）、陳腐化はメジャー更新タイミングの定期見直しで対処する。

## 関連

- **インフラ層の対称物**: `shirokuma-infra` が提供するインフラ層 reference（ローカル開発インフラの命名規則・サービス選定基準）と対称の位置づけ。インフラ層 reference は `shirokuma-infra` を参照。
- **scaffold 連携**: `setting-up-nextjs` が本スタックを参照し、開発環境ベースを bootstrap する。
