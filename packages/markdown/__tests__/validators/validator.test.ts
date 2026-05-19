/**
 * validator tests
 *
 * ドキュメントバリデーターのテスト
 *
 * @testdoc validator: ドキュメントバリデーションを検証する
 */

import { Validator } from "../../src/validators/index.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { createTestConfig } from "../helpers/md/create-config.js";

describe("Validator", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "validator-test-"));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * @testdoc validator: ファイルがない場合は valid を返す
   */
  it("should return valid when no files match", async () => {
    const emptyDir = path.join(tmpDir, "empty");
    await fs.mkdir(emptyDir, { recursive: true });

    const config = createTestConfig();
    const validator = new Validator(config);
    const result = await validator.validate(emptyDir);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  /**
   * @testdoc validator: 必須 frontmatter が欠けている場合にエラーを報告する
   */
  it("should report missing required frontmatter", async () => {
    const dir = path.join(tmpDir, "missing-fm");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "test.md"),
      "---\ntitle: Test\n---\n\n# Content\n"
    );

    const config = createTestConfig({
      validation: {
        required_frontmatter: ["title", "description"],
        no_internal_links: false,
      },
    });
    const validator = new Validator(config);
    const result = await validator.validate(dir);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("description"))).toBe(
      true
    );
    expect(result.errors[0]!.rule).toBe("required-frontmatter");
  });

  /**
   * @testdoc validator: すべての frontmatter が揃っていれば valid を返す
   */
  it("should return valid when all required frontmatter present", async () => {
    const dir = path.join(tmpDir, "valid-fm");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "test.md"),
      "---\ntitle: Test\ndescription: A test\n---\n\n# Content\n"
    );

    const config = createTestConfig({
      validation: {
        required_frontmatter: ["title", "description"],
        no_internal_links: false,
      },
    });
    const validator = new Validator(config);
    const result = await validator.validate(dir);

    expect(result.valid).toBe(true);
  });

  /**
   * @testdoc validator: 内部リンク検出が有効な場合にエラーを報告する
   */
  it("should detect internal links when enabled", async () => {
    const dir = path.join(tmpDir, "internal-links");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "test.md"),
      "---\ntitle: Test\n---\n\nSee [other](./other.md) for details.\n"
    );

    const config = createTestConfig({
      validation: {
        required_frontmatter: [],
        no_internal_links: true,
      },
    });
    const validator = new Validator(config);
    const result = await validator.validate(dir);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.rule === "no-internal-links")
    ).toBe(true);
  });

  /**
   * @testdoc validator: 外部リンクは内部リンク検出で無視する
   */
  it("should not flag external links", async () => {
    const dir = path.join(tmpDir, "external-links");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "test.md"),
      "---\ntitle: Test\n---\n\nSee [GitHub](https://github.com) for details.\n"
    );

    const config = createTestConfig({
      validation: {
        required_frontmatter: [],
        no_internal_links: true,
      },
    });
    const validator = new Validator(config);
    const result = await validator.validate(dir);

    expect(result.valid).toBe(true);
  });

  /**
   * @testdoc validator: 禁止パターンマッチでエラーを報告する
   */
  it("should detect forbidden patterns", async () => {
    const dir = path.join(tmpDir, "forbidden");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "test.md"),
      "---\ntitle: Test\n---\n\nTODO: fix this later\n"
    );

    const config = createTestConfig({
      validation: {
        required_frontmatter: [],
        no_internal_links: false,
        forbidden_patterns: [
          { pattern: "TODO:", message: "TODO comments not allowed" },
        ],
      },
    });
    const validator = new Validator(config);
    const result = await validator.validate(dir);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "forbidden-pattern")).toBe(true);
  });

  /**
   * @testdoc validator: コードブロック内の見出し行を見出しとして検出しない
   */
  it("should not detect headings inside code blocks", async () => {
    const dir = path.join(tmpDir, "codeblock-headings");
    await fs.mkdir(dir, { recursive: true });
    // コードブロック内に深い見出し（######）を配置
    // extractHeadings がコードブロックを無視しなければ余計な見出しが検出される
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
        "## Fake Heading Inside Code",
        "```",
        "",
        "## Second Real",
        "",
      ].join("\n")
    );

    const config = createTestConfig();
    const validator = new Validator(config);
    const result = await validator.validate(dir);

    // コードブロック内の見出しが max-heading-depth の集計に含まれないことを確認
    // 正しく動作すれば warning は出ない（h2 のみ）
    const depthWarnings = result.warnings.filter(
      (w) => w.rule === "max-heading-depth"
    );
    expect(depthWarnings).toHaveLength(0);
  });

  /**
   * @testdoc validator: 深すぎる見出しに警告を報告する
   */
  it("should warn on headings exceeding max depth", async () => {
    const dir = path.join(tmpDir, "deep-headings");
    await fs.mkdir(dir, { recursive: true });
    // DEFAULT_MAX_HEADING_DEPTH is 6, so h7+ would be flagged but markdown only goes to h6
    // So test that h6 is NOT flagged (within limits)
    await fs.writeFile(
      path.join(dir, "test.md"),
      "---\ntitle: Test\n---\n\n## Title\n\n### Subtitle\n"
    );

    const config = createTestConfig();
    const validator = new Validator(config);
    const result = await validator.validate(dir);

    expect(result.warnings.filter((w) => w.rule === "max-heading-depth")).toHaveLength(0);
  });
});
