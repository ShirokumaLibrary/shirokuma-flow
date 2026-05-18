/**
 * brace-matching ユーティリティのテスト
 *
 * @testdoc 波括弧のマッチングとカウント関数の動作を検証（文字列・コメント内の波括弧除外を含む）
 */
import { describe, expect, it } from "vitest";
import { findMatchingBrace, countBraces } from "../src/brace-matching.js";

describe("findMatchingBrace", () => {
  it("単純な波括弧ペアの閉じ位置を返す", () => {
    expect(findMatchingBrace("{}", 0)).toBe(1);
  });

  it("ネストした波括弧の閉じ位置を返す", () => {
    expect(findMatchingBrace("{ { } }", 0)).toBe(6);
  });

  it("開き波括弧でない位置に対して null を返す", () => {
    expect(findMatchingBrace("abc", 0)).toBeNull();
  });

  it("対応する閉じ波括弧がない場合 null を返す", () => {
    expect(findMatchingBrace("{ {", 0)).toBeNull();
  });

  it("文字列リテラル内の波括弧を無視する（ダブルクォート）", () => {
    const src = '{ "}" }';
    expect(findMatchingBrace(src, 0)).toBe(6);
  });

  it("文字列リテラル内の波括弧を無視する（シングルクォート）", () => {
    const src = "{ '}' }";
    expect(findMatchingBrace(src, 0)).toBe(6);
  });

  it("文字列リテラル内の波括弧を無視する（バッククォート）", () => {
    const src = "{ `}` }";
    expect(findMatchingBrace(src, 0)).toBe(6);
  });

  it("エスケープされた引用符を正しく処理する", () => {
    const src = '{ "\\"}\\""  }';
    expect(findMatchingBrace(src, 0)).toBe(src.length - 1);
  });

  it("行コメント内の波括弧を無視する", () => {
    const src = "{\n  // { comment }\n}";
    expect(findMatchingBrace(src, 0)).toBe(src.length - 1);
  });

  it("ブロックコメント内の波括弧を無視する", () => {
    const src = "{\n  /* { block } */\n}";
    expect(findMatchingBrace(src, 0)).toBe(src.length - 1);
  });

  it("Drizzle スキーマの文字列デフォルト値を正しく処理する", () => {
    const src = `{
  description: varchar("col").default("{invalid}"),
  name: varchar("name"),
}`;
    expect(findMatchingBrace(src, 0)).toBe(src.length - 1);
  });

  it("複数の文字列リテラルが混在するケースを処理する", () => {
    const src = `{
  a: "{ }",
  b: '{ }',
  c: \`{ }\`,
}`;
    expect(findMatchingBrace(src, 0)).toBe(src.length - 1);
  });

  it("途中の開き波括弧から検索できる", () => {
    const src = "outer { inner { } }";
    expect(findMatchingBrace(src, 6)).toBe(18);
    expect(findMatchingBrace(src, 14)).toBe(16);
  });

  it("コメントと文字列が混在する複雑なケースを処理する", () => {
    const src = `{
  // const x = "{"
  const y = "}" // { ignore }
  /* { block
     comment } */
  const z = \`template { }\`
}`;
    expect(findMatchingBrace(src, 0)).toBe(src.length - 1);
  });
});

describe("countBraces", () => {
  it("単一の開き波括弧をカウントする", () => {
    expect(countBraces("{")).toBe(1);
  });

  it("バランスした波括弧で 0 を返す", () => {
    expect(countBraces("{ }")).toBe(0);
  });

  it("ネストした波括弧をカウントする", () => {
    expect(countBraces("{ { } }")).toBe(0);
    expect(countBraces("{ {")).toBe(2);
  });

  it("文字列リテラル内の波括弧を無視する（ダブルクォート）", () => {
    expect(countBraces('const x = "{ }"')).toBe(0);
  });

  it("文字列リテラル内の波括弧を無視する（シングルクォート）", () => {
    expect(countBraces("const x = '{ }'")).toBe(0);
  });

  it("文字列リテラル内の波括弧を無視する（バッククォート）", () => {
    expect(countBraces("const x = `{ }`")).toBe(0);
  });

  it("空文字列で 0 を返す", () => {
    expect(countBraces("")).toBe(0);
  });

  it("エスケープされた文字を正しく処理する", () => {
    expect(countBraces('const x = "\\"{\\""')).toBe(0);
  });

  it("行コメント内の波括弧を無視する", () => {
    expect(countBraces("const x = 1; // { comment }")).toBe(0);
  });

  it("行コメント前のコードの波括弧はカウントする", () => {
    expect(countBraces("if (true) { // open")).toBe(1);
  });

  it("Drizzle のデフォルト値パターンを正しく処理する", () => {
    expect(countBraces('  description: varchar("col").default("{invalid}"),')).toBe(0);
  });
});
