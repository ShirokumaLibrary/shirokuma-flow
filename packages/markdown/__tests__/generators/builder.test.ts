/**
 * builder tests
 *
 * ドキュメントビルダーのテスト
 *
 * @testdoc builder: ドキュメントビルドを検証する
 */

import { Builder } from "../../src/generators/builder.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { createTestConfig } from "../helpers/md/create-config.js";

describe("Builder", () => {
  let tmpDir: string;
  let sourceDir: string;
  let outputDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "builder-test-"));
    sourceDir = path.join(tmpDir, "src");
    outputDir = path.join(tmpDir, "out");
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * @testdoc builder: 複数ファイルを結合してビルドする
   */
  it("should build combined output from multiple files", async () => {
    const dir = path.join(sourceDir, "basic");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "a.md"),
      "---\ntitle: A\n---\n\n## Section A\n\nContent A.\n"
    );
    await fs.writeFile(
      path.join(dir, "b.md"),
      "---\ntitle: B\n---\n\n## Section B\n\nContent B.\n"
    );

    const outputPath = path.join(outputDir, "basic.md");
    const config = createTestConfig();
    const builder = new Builder(config);
    const result = await builder.build(dir, outputPath);

    expect(result.fileCount).toBe(2);
    expect(result.totalSize).toBeGreaterThan(0);
    expect(result.buildTime).toBeGreaterThanOrEqual(0);

    const output = await fs.readFile(outputPath, "utf-8");
    expect(output).toContain("Section A");
    expect(output).toContain("Section B");
  });

  /**
   * @testdoc builder: ファイルがない場合にエラーをスローする
   */
  it("should throw when no files found", async () => {
    const emptyDir = path.join(sourceDir, "empty");
    await fs.mkdir(emptyDir, { recursive: true });

    const config = createTestConfig();
    const builder = new Builder(config);

    await expect(
      builder.build(emptyDir, path.join(outputDir, "empty.md"))
    ).rejects.toThrow("No files found");
  });

  /**
   * @testdoc builder: frontmatter ストリップが有効な場合に frontmatter を除去する
   */
  it("should strip frontmatter when enabled", async () => {
    const dir = path.join(sourceDir, "strip-fm");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "test.md"),
      "---\ntitle: Test\nauthor: Bot\n---\n\n## Content\n\nBody text.\n"
    );

    const outputPath = path.join(outputDir, "strip-fm.md");
    const config = createTestConfig();
    const builder = new Builder(config);
    await builder.build(dir, outputPath);

    const output = await fs.readFile(outputPath, "utf-8");
    expect(output).not.toContain("author: Bot");
    expect(output).toContain("Content");
  });

  /**
   * @testdoc builder: TOC が有効な場合に目次を生成する
   */
  it("should generate TOC when enabled", async () => {
    const dir = path.join(sourceDir, "toc");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "test.md"),
      "---\ntitle: Test\n---\n\n## Introduction\n\n### Setup\n\n## Usage\n"
    );

    const outputPath = path.join(outputDir, "toc.md");
    const config = createTestConfig();
    config.build.toc = { enabled: true, depth: 3, title: "Table of Contents" };
    const builder = new Builder(config);
    await builder.build(dir, outputPath);

    const output = await fs.readFile(outputPath, "utf-8");
    expect(output).toContain("Table of Contents");
    expect(output).toContain("Introduction");
  });

  /**
   * @testdoc builder: 日本語見出しの TOC リンクが正しいスラグを生成する
   */
  it("should generate valid slugs for Japanese headings in TOC", async () => {
    const dir = path.join(sourceDir, "toc-ja");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "test.md"),
      "---\ntitle: Test\n---\n\n## はじめに\n\n### セットアップ手順\n"
    );

    const outputPath = path.join(outputDir, "toc-ja.md");
    const config = createTestConfig();
    config.build.toc = { enabled: true, depth: 3, title: "目次" };
    const builder = new Builder(config);
    await builder.build(dir, outputPath);

    const output = await fs.readFile(outputPath, "utf-8");
    expect(output).toContain("目次");
    // スラグが空にならないこと（日本語文字が保持される）
    expect(output).toMatch(/\[はじめに\]\(#[^\s)]+\)/);
    expect(output).not.toMatch(/\[はじめに\]\(#\)/);
  });

  /**
   * @testdoc builder: CJK と英語が混在する見出しの TOC スラグを正しく生成する
   */
  it("should generate valid slugs for mixed CJK and English headings", async () => {
    const dir = path.join(sourceDir, "toc-mixed");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "test.md"),
      "---\ntitle: Test\n---\n\n## API リファレンス\n"
    );

    const outputPath = path.join(outputDir, "toc-mixed.md");
    const config = createTestConfig();
    config.build.toc = { enabled: true, depth: 3, title: "TOC" };
    const builder = new Builder(config);
    await builder.build(dir, outputPath);

    const output = await fs.readFile(outputPath, "utf-8");
    // "API リファレンス" のスラグに "api" と日本語文字が含まれる
    expect(output).toMatch(/\[API リファレンス\]\(#api-リファレンス\)/);
  });

  /**
   * @testdoc builder: コードブロック内の見出し行を TOC に含めない
   */
  it("should not include headings inside code blocks in TOC", async () => {
    const dir = path.join(sourceDir, "toc-codeblock");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "test.md"),
      [
        "---",
        "title: Test",
        "---",
        "",
        "## Real Heading",
        "",
        "```markdown",
        "## Fake Heading Inside Code Block",
        "```",
        "",
        "## Another Real Heading",
        "",
      ].join("\n")
    );

    const outputPath = path.join(outputDir, "toc-codeblock.md");
    const config = createTestConfig();
    config.build.toc = { enabled: true, depth: 3, title: "TOC" };
    const builder = new Builder(config);
    await builder.build(dir, outputPath);

    const output = await fs.readFile(outputPath, "utf-8");
    expect(output).toContain("Real Heading");
    expect(output).toContain("Another Real Heading");
    // コードブロック内の見出しが TOC エントリとして表示されないこと
    expect(output).not.toMatch(/\[Fake Heading Inside Code Block\]\(#/);
  });

  /**
   * @testdoc builder: トークン数を返す
   */
  it("should return token count in result", async () => {
    const dir = path.join(sourceDir, "tokens");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "test.md"),
      "---\ntitle: Test\n---\n\n## Title\n\nSome content here.\n"
    );

    const outputPath = path.join(outputDir, "tokens.md");
    const config = createTestConfig();
    const builder = new Builder(config);
    const result = await builder.build(dir, outputPath);

    expect(result.tokenCount).toBeGreaterThan(0);
  });
});
