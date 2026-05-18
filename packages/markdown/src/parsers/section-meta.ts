import { parse as parseYAML } from 'yaml';

/**
 * Section metadata interface
 */
export interface SectionMeta {
  /** Line number where section-meta starts */
  lineNumber: number;
  /** Raw HTML comment content */
  raw: string;
  /** Parsed YAML content */
  parsed: Record<string, unknown>;
}

/**
 * Result of section-meta extraction
 */
export interface SectionMetaExtractionResult {
  /** Extracted section metadata */
  sectionMeta: SectionMeta[];
  /** Markdown with section-meta removed */
  cleaned: string;
}

/**
 * Extract all section-meta from markdown content
 * @param markdown - Markdown content
 * @returns Extraction result with metadata and cleaned content
 */
export function extractSectionMeta(markdown: string): SectionMetaExtractionResult {
  const lines = markdown.split('\n');
  const sectionMeta: SectionMeta[] = [];

  let lineNumber = 0;
  let inCodeBlock = false;
  let inSectionMeta = false;
  let sectionMetaStart = -1;
  let sectionMetaLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    lineNumber = i + 1;

    // Track code blocks to avoid processing section-meta inside them
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Skip lines inside code blocks
    if (inCodeBlock) {
      continue;
    }

    // Detect section-meta start
    if (line.trim() === '<!-- section-meta') {
      inSectionMeta = true;
      sectionMetaStart = lineNumber;
      sectionMetaLines = [];
      continue;
    }

    // Collect section-meta lines
    if (inSectionMeta && line.trim() !== '-->') {
      sectionMetaLines.push(line);
      continue;
    }

    // Detect section-meta end
    if (inSectionMeta && line.trim() === '-->') {
      inSectionMeta = false;

      try {
        // Parse YAML content
        const yamlContent = sectionMetaLines.join('\n');
        // yaml.parse returns unknown; cast to Record<string, unknown>
        const parsed: Record<string, unknown> | null = parseYAML(yamlContent) as Record<string, unknown> | null;

        sectionMeta.push({
          lineNumber: sectionMetaStart,
          raw: `<!-- section-meta\n${yamlContent}\n-->`,
          parsed: parsed ?? {},
        });
      } catch {
        // Invalid YAML - skip this section-meta
        console.warn(`Warning: Invalid YAML in section-meta at line ${sectionMetaStart}`);
      }

      continue;
    }
  }

  return {
    sectionMeta,
    cleaned: markdown, // Will be implemented in stripSectionMeta
  };
}

/**
 * Strip all section-meta from markdown content
 * Preserves section-meta inside code blocks and inline code
 * @param markdown - Markdown content
 * @returns Markdown with section-meta removed
 */
export function stripSectionMeta(markdown: string): string {
  // Step 1: Extract code blocks and replace with placeholders
  const codeBlocks: string[] = [];
  const codeBlockPlaceholder = '___CODE_BLOCK_PLACEHOLDER___';

  let withPlaceholders = markdown.replace(
    /```[\s\S]*?```/g,
    (match) => {
      codeBlocks.push(match);
      return `${codeBlockPlaceholder}${codeBlocks.length - 1}${codeBlockPlaceholder}`;
    }
  );

  // Step 2: Remove section-meta patterns (multiline HTML comments)
  withPlaceholders = withPlaceholders.replace(
    /<!--\s*section-meta[\s\S]*?-->/g,
    ''
  );

  // Step 3: Clean up excessive blank lines (max 2 consecutive)
  withPlaceholders = withPlaceholders.replace(/\n{3,}/g, '\n\n');

  // Step 4: Restore code blocks
  let restored = withPlaceholders;
  codeBlocks.forEach((block, index) => {
    const placeholder = `${codeBlockPlaceholder}${index}${codeBlockPlaceholder}`;
    restored = restored.replace(placeholder, block);
  });

  return restored;
}

/**
 * Validate section-meta YAML syntax
 * @param markdown - Markdown content
 * @returns Array of validation errors
 */
export function validateSectionMeta(markdown: string): Array<{ lineNumber: number; error: string }> {
  const errors: Array<{ lineNumber: number; error: string }> = [];
  const lines = markdown.split('\n');

  let lineNumber = 0;
  let inCodeBlock = false;
  let inSectionMeta = false;
  let sectionMetaStart = -1;
  let sectionMetaLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    lineNumber = i + 1;

    // Track code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      continue;
    }

    // Detect section-meta start
    if (line.trim() === '<!-- section-meta') {
      inSectionMeta = true;
      sectionMetaStart = lineNumber;
      sectionMetaLines = [];
      continue;
    }

    // Collect section-meta lines
    if (inSectionMeta && line.trim() !== '-->') {
      sectionMetaLines.push(line);
      continue;
    }

    // Validate on end
    if (inSectionMeta && line.trim() === '-->') {
      inSectionMeta = false;

      try {
        const yamlContent = sectionMetaLines.join('\n');
        parseYAML(yamlContent);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({
          lineNumber: sectionMetaStart,
          error: `Invalid YAML syntax: ${message}`,
        });
      }

      continue;
    }
  }

  // Check for unclosed section-meta
  if (inSectionMeta) {
    errors.push({
      lineNumber: sectionMetaStart,
      error: 'Unclosed section-meta (missing -->)',
    });
  }

  return errors;
}

/**
 * Get section-meta for a specific heading
 * @param markdown - Markdown content
 * @param headingText - Heading text to search for
 * @returns Section metadata or null if not found
 */
export function getSectionMeta(markdown: string, headingText: string): Record<string, unknown> | null {
  const lines = markdown.split('\n');

  let inCodeBlock = false;
  let foundHeading = false;
  let inSectionMeta = false;
  let sectionMetaLines: string[] = [];

  for (const line of lines) {
    if (!line) continue;

    // Track code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      continue;
    }

    // Check if this is the heading we're looking for
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch && headingMatch[2]?.trim() === headingText.trim()) {
      foundHeading = true;
      continue;
    }

    // If we found the heading, look for section-meta
    if (foundHeading) {
      if (line.trim() === '<!-- section-meta') {
        inSectionMeta = true;
        sectionMetaLines = [];
        continue;
      }

      if (inSectionMeta && line.trim() !== '-->') {
        sectionMetaLines.push(line);
        continue;
      }

      if (inSectionMeta && line.trim() === '-->') {
        try {
          const yamlContent = sectionMetaLines.join('\n');
          return (parseYAML(yamlContent) as Record<string, unknown> | null) ?? {};
        } catch {
          return null;
        }
      }

      // If we hit another heading or non-empty content, stop searching
      if (line.match(/^#{1,6}\s+/) || (line.trim() && !line.trim().startsWith('<!--'))) {
        return null;
      }
    }
  }

  return null;
}
