# アーキテクチャ対応表雛形（architecture）

design-worker が **DDD レベル L2**（[../criteria/ddd-adoption.md](../criteria/ddd-adoption.md)）の課題で、BC を実装の所在へ対応づけるときに埋める雛形。プロジェクトの `domain/architecture.md` の下敷きにする。[bounded-contexts.md](bounded-contexts.md) で BC を切り、[domain-model.md](domain-model.md) で集約を立ててから本雛形で実装へ写す。

書き方の規律:

- **対応表は「BC → 実装の所在」だけを持つ**: 1 行 1 BC で、パッケージ / モジュールの所在と主な集約を書く。CLI verb や skill の全量列挙はしない（列挙は腐る・稼働インベントリの正本は filesystem）。
- **BC 名は行頭のセルに強調（`**…**`）で置く**（行頭が `| **` で始まり、`**` の直後が空白・`*`・`|` 以外の 1 文字である形。**BC 名の言語は問わない**——日本語の BC 名でも数えられる）。`auditing-docs` の **DDD レベル L2** 検査はこの形の行を数え、0 件なら `ddd-artifact-empty`(error) になる。雛形の記入例の行がそのまま 1 件に数えられる（検査はこの形を追認するだけで、新しい書式を課さない）。
- **表のヘッダ行は強調しない**（`| BC | 所在… |` の形にする）。ヘッダを `| **BC** | …` と書くと**ヘッダ自身が上の判定に合致する**ので、中身を 1 行も書いていない対応表が検査を通ってしまう（母集団 0 のカナリアが空虚に成立する）。強調するのは本文行の BC 名だけにする。
- **決定の Why は ADR に置き、本書からは参照**する（本書は What の写像で、Why を転記しない）。
- 状態遷移・Issue 提出は orchestrator が flow verb で行う（worker は本文を作るだけ）。

---

```markdown
# アーキテクチャ導出（BC → 実装の所在）

[bounded-contexts](bounded-contexts.md) / [domain-model](domain-model.md) の BC・集約を、実装の所在（パッケージ / モジュール）へ対応づける。本表は **BC 導出の代表例**であり、稼働インベントリの正本は filesystem。

## BC → 実装の所在

| BC | 所在（パッケージ / モジュール） | 主な集約 | 備考 |
|---|---|---|---|
| **Order Fulfillment** | `packages/app/src/domain/` | Shipment | 記入例。自プロジェクトの BC・所在に置き換える（[ADR-xxxx]） |

## 次
各行の所在に対して実装単位（CLI verb / skill / agent / rule 等）を置く。

---

[ADR-xxxx]: {決定の Why を置いた ADR（Discussion 等）への URL}
```
