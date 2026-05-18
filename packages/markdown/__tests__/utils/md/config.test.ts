/**
 * config utils tests
 *
 * 設定ファイルのロード・デフォルト値のテスト
 *
 * @testdoc configUtils: 設定ロードユーティリティを検証する
 */

import { loadConfig, getDefaultConfig } from "../../../src/utils/md/config.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("getDefaultConfig", () => {
  /**
   * @testdoc configUtils: デフォルト設定を返す
   */
  it("should return default configuration", () => {
    const config = getDefaultConfig();

    expect(config.directories).toBeDefined();
    expect(config.directories!.source).toBe("docs/");
    expect(config.directories!.output).toBe("dist/");
    expect(config.build).toBeDefined();
    expect(config.build!.include).toContain("**/*.md");
    expect(config.validation).toBeDefined();
  });
});

describe("loadConfig", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "config-test-"));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * @testdoc configUtils: YAML 設定ファイルを正しくロードする
   */
  it("should load valid YAML config", async () => {
    const configPath = path.join(tmpDir, "config.yaml");
    await fs.writeFile(
      configPath,
      `
project:
  name: "test"
  version: "0.1.0"
directories:
  source: "docs/"
  output: "dist/"
  config: ".shirokuma/"
build:
  default_output: "output.md"
  include:
    - "**/*.md"
  exclude:
    - "node_modules/**"
  frontmatter:
    strip: true
  toc:
    enabled: false
    depth: 3
    title: "TOC"
  file_separator: "\\n---\\n"
  sort: "path"
  strip_section_meta: false
  strip_heading_numbers: false
validation:
  required_frontmatter: []
  no_internal_links: false
lint:
  builtin_rules: {}
`
    );

    const config = await loadConfig(configPath);

    expect(config.directories.source).toBe("docs/");
    expect(config.build.include).toContain("**/*.md");
  });

  /**
   * @testdoc configUtils: 存在しない設定ファイルでエラーをスローする
   */
  it("should throw for non-existent config file", async () => {
    await expect(
      loadConfig(path.join(tmpDir, "nonexistent.yaml"))
    ).rejects.toThrow();
  });

  /**
   * @testdoc configUtils: サポートされていない拡張子でエラーをスローする
   */
  it("should throw for unsupported extension", async () => {
    const badPath = path.join(tmpDir, "config.xml");
    await fs.writeFile(badPath, "<config/>");

    await expect(loadConfig(badPath)).rejects.toThrow("Unsupported config");
  });

  /**
   * @testdoc configUtils: デフォルトパスが見つからない場合にエラーをスローする
   */
  it("should throw when no default config found", async () => {
    // This will search CWD for default config files and fail
    const originalCwd = process.cwd();
    const emptyDir = path.join(tmpDir, "no-config");
    await fs.mkdir(emptyDir, { recursive: true });

    process.chdir(emptyDir);
    try {
      await expect(loadConfig()).rejects.toThrow("No configuration file found");
    } finally {
      process.chdir(originalCwd);
    }
  });
});
