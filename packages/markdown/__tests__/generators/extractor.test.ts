/**
 * extractor tests
 *
 * 情報抽出・frontmatter 生成のテスト
 *
 * @testdoc extractor: 情報抽出を検証する
 */

import { Extractor } from "../../src/generators/extractor.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { createTestConfig } from "../helpers/md/create-config.js";

describe("Extractor", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "extractor-test-"));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * @testdoc extractor: extraction 設定がない場合にエラーを返す
   */
  it("should return error when no extraction config", async () => {
    const dir = path.join(tmpDir, "no-config");
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, "test.md");
    await fs.writeFile(filePath, "# Test\n\nName: Alice\n");

    const config = createTestConfig();
    const extractor = new Extractor(config);
    const result = await extractor.extract(filePath, "character");

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Extraction configuration"))).toBe(true);
  });

  /**
   * @testdoc extractor: パターンに一致するフィールドを抽出する
   */
  it("should extract fields matching patterns", async () => {
    const dir = path.join(tmpDir, "extract");
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, "char.md");
    await fs.writeFile(filePath, "# Character\n\nName: Alice\nAge: 25\n");

    const config = createTestConfig({
      extraction: {
        patterns: {
          character: {
            name: { pattern: "Name:\\s*(.+)", group: 1, type: "string" },
            age: { pattern: "Age:\\s*(\\d+)", group: 1, type: "integer" },
          },
        },
      },
    });
    const extractor = new Extractor(config);
    const result = await extractor.extract(filePath, "character");

    expect(result.success).toBe(true);
    expect(result.extractedFields.name).toBe("Alice");
    expect(result.extractedFields.age).toBe(25);
    expect(result.stats.fieldsExtracted).toBe(2);
  });

  /**
   * @testdoc extractor: 存在しないドキュメントタイプでエラーを返す
   */
  it("should return error for unknown document type", async () => {
    const filePath = path.join(tmpDir, "extract", "char.md");

    const config = createTestConfig({
      extraction: { patterns: {} },
    });
    const extractor = new Extractor(config);
    const result = await extractor.extract(filePath, "nonexistent");

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("No extraction patterns"))).toBe(true);
  });

  /**
   * @testdoc extractor: 必須フィールドが見つからない場合にエラーを返す
   */
  it("should report missing required fields", async () => {
    const dir = path.join(tmpDir, "required");
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, "test.md");
    await fs.writeFile(filePath, "# Test\n\nNo matching content.\n");

    const config = createTestConfig({
      extraction: {
        patterns: {
          test: {
            name: {
              pattern: "Name:\\s*(.+)",
              group: 1,
              type: "string",
              required: true,
            },
          },
        },
      },
    });
    const extractor = new Extractor(config);
    const result = await extractor.extract(filePath, "test");

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Missing required field"))).toBe(true);
  });

  /**
   * @testdoc extractor: バッチ抽出でコロンを含む値を正しく集計する
   */
  it("should correctly aggregate unmapped values containing colons", async () => {
    const dir = path.join(tmpDir, "colon-values");
    const outDir = path.join(tmpDir, "colon-values-out");
    await fs.mkdir(dir, { recursive: true });
    await fs.mkdir(outDir, { recursive: true });
    const file1 = path.join(dir, "item1.md");
    const file2 = path.join(dir, "item2.md");
    await fs.writeFile(file1, "# Item 1\n\nSource: http://example.com\n");
    await fs.writeFile(file2, "# Item 2\n\nSource: http://example.com\n");

    const config = createTestConfig({
      extraction: {
        patterns: {
          item: {
            source: {
              pattern: "Source:\\s*(.+)",
              group: 1,
              type: "string",
              mapping: "source_mapping",
            },
          },
        },
        mappings: {
          source_mapping: {
            "internal": "internal",
            "external": "external",
          },
        },
      },
    });
    const extractor = new Extractor(config);
    const result = await extractor.batchExtract(dir, "item", outDir, {
      continueOnError: true,
    });

    // "http://example.com" は mapping に含まれないため unmapped value として報告される
    // コロンを含む値が正しく復元されることを確認
    expect(result.unmappedValues.length).toBeGreaterThan(0);
    const httpUnmapped = result.unmappedValues.find(
      (v) => v.field === "source"
    );
    expect(httpUnmapped).toBeDefined();
    expect(httpUnmapped!.value).toBe("http://example.com");
    expect(httpUnmapped!.count).toBe(2);
  });

  /**
   * @testdoc extractor: 抽出率を正しく計算する
   */
  it("should calculate extraction rate", async () => {
    const dir = path.join(tmpDir, "rate");
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, "test.md");
    await fs.writeFile(filePath, "Name: Bob\n");

    const config = createTestConfig({
      extraction: {
        patterns: {
          test: {
            name: { pattern: "Name:\\s*(.+)", group: 1, type: "string" },
            missing: { pattern: "Missing:\\s*(.+)", group: 1, type: "string" },
          },
        },
      },
    });
    const extractor = new Extractor(config);
    const result = await extractor.extract(filePath, "test");

    expect(result.stats.extractionRate).toBe(50);
  });
});
