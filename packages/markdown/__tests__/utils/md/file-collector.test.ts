/**
 * file-collector utils tests
 *
 * ファイル収集ユーティリティのテスト
 *
 * @testdoc fileCollector: ファイル収集ユーティリティを検証する
 */

import {
  FileCollector,
  createFileCollector,
} from "../../../src/utils/md/file-collector.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { createTestConfig } from "../../helpers/md/create-config.js";

function createConfig() {
  return createTestConfig({ build: { exclude: ["node_modules/**", "**/excluded/**"] } });
}

describe("FileCollector", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fc-test-"));

    // Create test file structure
    await fs.writeFile(path.join(tmpDir, "a.md"), "# A\n");
    await fs.writeFile(path.join(tmpDir, "b.md"), "# B\n");
    await fs.mkdir(path.join(tmpDir, "sub"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, "sub", "c.md"), "# C\n");
    await fs.writeFile(path.join(tmpDir, "readme.txt"), "text\n");
    await fs.mkdir(path.join(tmpDir, "excluded"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, "excluded", "d.md"), "# D\n");
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * @testdoc fileCollector: パターンに一致する Markdown ファイルを収集する
   */
  it("should collect markdown files matching patterns", async () => {
    const config = createConfig();
    const collector = new FileCollector(config);
    const files = await collector.collect(tmpDir);

    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files.some((f) => f.endsWith("a.md"))).toBe(true);
    expect(files.some((f) => f.endsWith("b.md"))).toBe(true);
    expect(files.some((f) => f.endsWith("c.md"))).toBe(true);
    // Should not include .txt files
    expect(files.some((f) => f.endsWith(".txt"))).toBe(false);
  });

  /**
   * @testdoc fileCollector: 除外パターンに一致するファイルを除外する
   */
  it("should exclude files matching exclude patterns", async () => {
    const config = createConfig();
    const collector = new FileCollector(config);
    const files = await collector.collect(tmpDir);

    expect(files.some((f) => f.includes("excluded"))).toBe(false);
  });

  /**
   * @testdoc fileCollector: 重複ファイルを除去する
   */
  it("should deduplicate files", async () => {
    const config = createConfig();
    config.build.include = ["**/*.md", "*.md"]; // Overlapping patterns
    const collector = new FileCollector(config);
    const files = await collector.collect(tmpDir);

    const uniquePaths = new Set(files);
    expect(files.length).toBe(uniquePaths.size);
  });

  /**
   * @testdoc fileCollector: 相対パスを返す
   */
  it("should return relative paths", async () => {
    const config = createConfig();
    const collector = new FileCollector(config);
    const files = await collector.collectRelative(tmpDir);

    for (const file of files) {
      expect(path.isAbsolute(file)).toBe(false);
    }
  });

  /**
   * @testdoc fileCollector: ファイル数をカウントする
   */
  it("should count files", async () => {
    const config = createConfig();
    const collector = new FileCollector(config);
    const count = await collector.count(tmpDir);

    expect(count).toBeGreaterThanOrEqual(3);
  });

  /**
   * @testdoc fileCollector: フィルタ付きで収集する
   */
  it("should collect with custom filter", async () => {
    const config = createConfig();
    const collector = new FileCollector(config);
    const files = await collector.collectFiltered(
      tmpDir,
      (f) => f.endsWith("a.md")
    );

    expect(files).toHaveLength(1);
    expect(files[0]).toContain("a.md");
  });
});

describe("createFileCollector", () => {
  /**
   * @testdoc fileCollector: ヘルパー関数でインスタンスを作成する
   */
  it("should create FileCollector instance", () => {
    const config = createConfig();
    const collector = createFileCollector(config);

    expect(collector).toBeInstanceOf(FileCollector);
  });
});
