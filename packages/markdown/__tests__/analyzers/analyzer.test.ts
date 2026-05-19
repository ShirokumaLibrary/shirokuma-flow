/**
 * analyzer tests
 *
 * ドキュメント分析・依存関係解析のテスト
 *
 * @testdoc analyzer: ドキュメント分析を検証する
 */

import { Analyzer } from "../../src/analyzers/index.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { createTestConfig } from "../helpers/md/create-config.js";

describe("Analyzer", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "analyzer-test-"));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * @testdoc analyzer: 基本的な分析結果を返す
   */
  it("should return basic analysis result", async () => {
    const dir = path.join(tmpDir, "basic");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "a.md"),
      "---\ntitle: A\n---\n\n## Section A\n\nContent.\n"
    );
    await fs.writeFile(
      path.join(dir, "b.md"),
      "---\ntitle: B\n---\n\n## Section B\n\nSee [A](a.md).\n"
    );

    const config = createTestConfig();
    const analyzer = new Analyzer(config);
    const result = await analyzer.analyze(dir);

    expect(result.totalFiles).toBe(2);
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * @testdoc analyzer: wiki リンクから依存関係を抽出する
   */
  it("should extract wiki-link dependencies", async () => {
    const dir = path.join(tmpDir, "wiki");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "a.md"),
      "---\ntitle: A\n---\n\nSee [[b]] for details.\n"
    );
    await fs.writeFile(
      path.join(dir, "b.md"),
      "---\ntitle: B\n---\n\nContent.\n"
    );

    const config = createTestConfig();
    const analyzer = new Analyzer(config);
    const result = await analyzer.analyze(dir);

    expect(result.dependencies.some((d) => d.type === "wiki-link")).toBe(true);
  });

  /**
   * @testdoc analyzer: 循環依存を検出する
   */
  it("should detect circular dependencies", async () => {
    const dir = path.join(tmpDir, "cycle");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "x.md"),
      "---\ntitle: X\ndependencies:\n  - y.md\n---\n\nContent.\n"
    );
    await fs.writeFile(
      path.join(dir, "y.md"),
      "---\ntitle: Y\ndependencies:\n  - x.md\n---\n\nContent.\n"
    );

    const config = createTestConfig();
    const analyzer = new Analyzer(config);
    const result = await analyzer.analyze(dir);

    expect(result.cycles.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * @testdoc analyzer: メトリクスを含む分析結果を返す
   */
  it("should include metrics when requested", async () => {
    const dir = path.join(tmpDir, "metrics");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "test.md"),
      "---\ntitle: Test\n---\n\n## Heading\n\nSome content.\n"
    );

    const config = createTestConfig();
    const analyzer = new Analyzer(config);
    const result = await analyzer.analyze(dir, { includeMetrics: true });

    expect(result.fileMetrics).toBeDefined();
    expect(result.fileMetrics).toHaveLength(1);
    expect(result.fileMetrics![0]!.tokens).toBeGreaterThan(0);
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  /**
   * @testdoc analyzer: Mermaid グラフを生成する
   */
  it("should generate mermaid graph", async () => {
    const dir = path.join(tmpDir, "graph");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "a.md"),
      "---\ntitle: A\n---\n\nSee [B](b.md).\n"
    );
    await fs.writeFile(
      path.join(dir, "b.md"),
      "---\ntitle: B\n---\n\nContent.\n"
    );

    const config = createTestConfig();
    const analyzer = new Analyzer(config);
    const result = await analyzer.analyze(dir);
    const graph = analyzer.generateGraph(result);

    expect(graph).toContain("```mermaid");
    expect(graph).toContain("graph TD");
  });

  /**
   * @testdoc analyzer: ファイルがない場合は空の結果を返す
   */
  it("should handle empty directory", async () => {
    const dir = path.join(tmpDir, "empty-analyzer");
    await fs.mkdir(dir, { recursive: true });

    const config = createTestConfig();
    const analyzer = new Analyzer(config);
    const result = await analyzer.analyze(dir);

    expect(result.totalFiles).toBe(0);
    expect(result.dependencies).toHaveLength(0);
  });
});
