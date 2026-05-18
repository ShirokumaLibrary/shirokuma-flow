export const PACKAGE_NAME = '@shirokuma-library/context';

export type {
  StrategyMeta,
  IndividualStrategyMeta,
  FullSplitStrategyMeta,
  AnyPresetMeta,
} from './types.js';
export { PRESETS, listPresetNames, resolvePresetMeta } from './presets.js';
export type { PresetName } from './presets.js';
export { detectFromPackageJson } from './detect.js';
export type { DetectedPreset } from './detect.js';

export type { Logger } from './logger.js';
export { createConsoleLogger, NOOP_LOGGER } from './logger.js';

export type { FetchStats } from './stats.js';
export { createEmptyStats } from './stats.js';

export type { FetchResult } from './fetch-markdown.js';
export { fetchMarkdown, writeLastFetched, fetchAndSaveLlmsTxt } from './fetch-markdown.js';

export type { DocsSourceConfig, DocsFetchOptions } from './config-types.js';

export type { LlmsTxtEntry } from './llms-txt.js';
export { parseLlmsTxt, parseLlmsTxtWithTitles, buildTitleMap } from './llms-txt.js';

export type { SectionFormatter, SectionFormatterName } from './section-format.js';
export { resolveSectionFormatter, deriveSectionFilename, slugify } from './section-format.js';

export { fetchIndividual } from './fetch-individual.js';
export { fetchFullSplit } from './fetch-full-split.js';
export { fetchGithubTree } from './fetch-github-tree.js';

export type {
  GitHubRepoInfo,
  GitHubTreeEntry,
  GitHubTreeEntryWithSha,
  GitHubRequestOptions,
} from './github.js';
export {
  parseGithubRepoUrl,
  buildGithubRawUrl,
  fetchGithubTreeEntries,
  fetchGithubSubtreeBySha,
  resolveGithubTreeSha,
} from './github.js';

export { extractImageUrls, rewriteImagePaths } from './images.js';

export type { ProcessImagesParams, SvgConverter } from './process-images.js';
export { processImages } from './process-images.js';

export type { PresetExecuteParams, PresetExecutor } from './presets/index.js';
export { executePreset, loadPresetExecutor } from './execute-preset.js';

export {
  DEFAULT_CONTEXTS_ROOT,
  DEFAULT_DOCS_ROOT,
  resolveOutputDir,
  discoverFilesystemSources,
} from './fs-helpers.js';

export type { SourceStatus, ListSourcesParams } from './list.js';
export { listSources } from './list.js';

export type { RemoveSourceParams, RemoveSourceResult } from './remove.js';
export { removeSource } from './remove.js';

export type { SearchMatch, SearchParams, SearchResult } from './search.js';
export { search, searchFile, extractSection } from './search.js';

export type { ManifestEntry, WriteManifestParams } from './manifest.js';
export { parseManifest, formatManifest, writeManifest, removeManifestEntry } from './manifest.js';
