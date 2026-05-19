/**
 * lister tests
 *
 * ファイルリスター・フォーマッターのテスト
 *
 * @testdoc lister: ファイルリスト生成を検証する
 */

import { Lister } from "../../src/generators/lister.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { createTestConfig } from "../helpers/md/create-config.js";

describe("Lister", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lister-test-"));

    await fs.writeFile(
      path.join(tmpDir, "a.md"),
      "---\ntitle: Alpha\nlayer: 1\ntype: guide\ncategory: basics\n---\n\n# Alpha\n"
    );
    await fs.writeFile(
      path.join(tmpDir, "b.md"),
      "---\ntitle: Beta\nlayer: 2\ntype: reference\ncategory: advanced\n---\n\n# Beta\n"
    );
    await fs.mkdir(path.join(tmpDir, "sub"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "sub", "c.md"),
      "---\ntitle: Charlie\nlayer: 1\ntype: guide\n---\n\n# Charlie\n"
    );
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * @testdoc lister: ファイル一覧を返す
   */
  it("should list files with metadata", async () => {
    const config = createTestConfig();
    const lister = new Lister(config);
    const result = await lister.list(tmpDir);

    expect(result.files.length).toBeGreaterThanOrEqual(3);
    expect(result.stats.totalFiles).toBeGreaterThanOrEqual(3);
  });

  /**
   * @testdoc lister: レイヤーでフィルタリングする
   */
  it("should filter by layer", async () => {
    const config = createTestConfig();
    const lister = new Lister(config);
    const result = await lister.list(tmpDir, { layer: 1 });

    expect(result.files.every((f) => f.layer === 1)).toBe(true);
    expect(result.files.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * @testdoc lister: タイプでフィルタリングする
   */
  it("should filter by type", async () => {
    const config = createTestConfig();
    const lister = new Lister(config);
    const result = await lister.list(tmpDir, { type: "reference" });

    expect(result.files.every((f) => f.type === "reference")).toBe(true);
    expect(result.files).toHaveLength(1);
  });

  /**
   * @testdoc lister: simple 形式でフォーマットする
   */
  it("should format as simple list", async () => {
    const config = createTestConfig();
    const lister = new Lister(config);
    const result = await lister.list(tmpDir);
    const output = lister.format(result, "simple", tmpDir);

    expect(output).toContain("a.md");
    expect(output).toContain("b.md");
  });

  /**
   * @testdoc lister: markdown 形式でフォーマットする
   */
  it("should format as markdown", async () => {
    const config = createTestConfig();
    const lister = new Lister(config);
    const result = await lister.list(tmpDir);
    const output = lister.format(result, "markdown", tmpDir);

    expect(output).toContain("# Documentation Index");
    expect(output).toContain("Layer");
  });

  /**
   * @testdoc lister: JSON 形式でフォーマットする
   */
  it("should format as JSON", async () => {
    const config = createTestConfig();
    const lister = new Lister(config);
    const result = await lister.list(tmpDir);
    const output = lister.format(result, "json", tmpDir);
    const parsed = JSON.parse(output);

    expect(parsed.files).toBeDefined();
    expect(parsed.stats).toBeDefined();
  });

  /**
   * @testdoc lister: tree 形式でフォーマットする
   */
  it("should format as tree", async () => {
    const config = createTestConfig();
    const lister = new Lister(config);
    const result = await lister.list(tmpDir);
    const output = lister.format(result, "tree", tmpDir);

    expect(output).toContain("a.md");
    expect(output).toContain("sub");
  });

  /**
   * @testdoc lister: 統計情報を計算する
   */
  it("should calculate statistics", async () => {
    const config = createTestConfig();
    const lister = new Lister(config);
    const result = await lister.list(tmpDir);

    expect(result.stats.layers).toBeDefined();
    expect(result.stats.types).toBeDefined();
    expect(result.stats.categories).toBeDefined();
  });
});
