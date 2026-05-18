/**
 * template parser tests
 *
 * テンプレート変数処理のテスト
 *
 * @testdoc templateParser: テンプレート解析と変数検出を検証する
 */

import {
  extractHeadings,
  extractVariables,
  findMissingHeadings,
  findUnsubstitutedVariables,
  templateExists,
  loadTemplate,
} from "../../src/parsers/template.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("extractHeadings", () => {
  /**
   * @testdoc templateParser: 見出しテキストを抽出する
   */
  it("should extract heading texts", () => {
    const md = "## Introduction\n\n### Setup\n\n## Usage\n";
    const headings = extractHeadings(md);
    expect(headings).toEqual(["Introduction", "Setup", "Usage"]);
  });

  /**
   * @testdoc templateParser: コードブロック内の見出しを無視する
   */
  it("should ignore headings inside code blocks", () => {
    const md = "## Real\n\n```\n## Fake\n```\n";
    const headings = extractHeadings(md);
    expect(headings).toEqual(["Real"]);
  });

  /**
   * @testdoc templateParser: テンプレート変数を含む見出しをスキップする
   */
  it("should skip headings containing template variables", () => {
    const md = "## {{title}}\n\n## Overview\n";
    const headings = extractHeadings(md);
    expect(headings).toEqual(["Overview"]);
  });

  /**
   * @testdoc templateParser: 見出しがない場合は空配列を返す
   */
  it("should return empty array for no headings", () => {
    expect(extractHeadings("Just text.\n")).toEqual([]);
  });
});

describe("extractVariables", () => {
  /**
   * @testdoc templateParser: テンプレート変数を抽出する
   */
  it("should extract template variables", () => {
    const md = "Title: {{title}}\nAuthor: {{author}}\n";
    const vars = extractVariables(md);
    expect(vars).toContain("title");
    expect(vars).toContain("author");
  });

  /**
   * @testdoc templateParser: 重複変数を除去する
   */
  it("should deduplicate variables", () => {
    const md = "{{name}} and {{name}} again\n";
    const vars = extractVariables(md);
    expect(vars).toHaveLength(1);
    expect(vars).toContain("name");
  });

  /**
   * @testdoc templateParser: 変数がない場合は空配列を返す
   */
  it("should return empty for no variables", () => {
    expect(extractVariables("No variables here.\n")).toEqual([]);
  });
});

describe("findMissingHeadings", () => {
  /**
   * @testdoc templateParser: 不足している見出しを検出する
   */
  it("should find missing headings", () => {
    const content = "## Introduction\n";
    const required = ["Introduction", "Usage", "API"];
    const missing = findMissingHeadings(content, required);
    expect(missing).toEqual(["Usage", "API"]);
  });

  /**
   * @testdoc templateParser: すべての見出しが揃っていれば空配列を返す
   */
  it("should return empty when all headings present", () => {
    const content = "## Intro\n\n## Usage\n";
    const required = ["Intro", "Usage"];
    expect(findMissingHeadings(content, required)).toEqual([]);
  });

  /**
   * @testdoc templateParser: 大文字小文字を無視してマッチする
   */
  it("should match case-insensitively", () => {
    const content = "## introduction\n";
    const required = ["Introduction"];
    expect(findMissingHeadings(content, required)).toEqual([]);
  });
});

describe("findUnsubstitutedVariables", () => {
  /**
   * @testdoc templateParser: 未置換テンプレート変数を検出する
   */
  it("should detect unsubstituted variables", () => {
    const content = "Title: {{title}}\nBody text.\n";
    const vars = findUnsubstitutedVariables(content);
    expect(vars).toContain("title");
  });

  /**
   * @testdoc templateParser: 変数がなければ空配列を返す
   */
  it("should return empty if all substituted", () => {
    expect(findUnsubstitutedVariables("Normal text.\n")).toEqual([]);
  });
});

describe("templateExists", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tmpl-test-"));
    await fs.writeFile(path.join(tmpDir, "test.md"), "# Template\n");
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * @testdoc templateParser: 存在するテンプレートで true を返す
   */
  it("should return true for existing template", async () => {
    expect(await templateExists("test", tmpDir)).toBe(true);
  });

  /**
   * @testdoc templateParser: 存在しないテンプレートで false を返す
   */
  it("should return false for non-existent template", async () => {
    expect(await templateExists("nonexistent", tmpDir)).toBe(false);
  });
});

describe("loadTemplate", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tmpl-load-"));
    await fs.writeFile(
      path.join(tmpDir, "article.md"),
      "---\ntitle: Template\n---\n\n## Introduction\n\n## {{section}}\n\nContent with {{variable}}.\n"
    );
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * @testdoc templateParser: テンプレートを正しくロードする
   */
  it("should load template with headings and variables", async () => {
    const tmpl = await loadTemplate("article", tmpDir);
    expect(tmpl.requiredHeadings).toContain("Introduction");
    expect(tmpl.variables).toContain("section");
    expect(tmpl.variables).toContain("variable");
    expect(tmpl.frontmatter.title).toBe("Template");
  });

  /**
   * @testdoc templateParser: 存在しないテンプレートでエラーをスローする
   */
  it("should throw for non-existent template", async () => {
    await expect(loadTemplate("nonexistent", tmpDir)).rejects.toThrow(
      "Template not found"
    );
  });
});
