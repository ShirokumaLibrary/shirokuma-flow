import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ADR_BODY_PATH,
  buildCodemap,
  MAIN_INDEX_PATH,
  OUTPUT_PATHS,
  writeBuildResult,
} from '../src/build.js';

const FIXTURE_ROOT = resolve(__dirname, 'fixtures');

describe('buildCodemap', () => {
  it('produces main_index + bodies from fixture ADR directory', () => {
    const result = buildCodemap({ projectPath: FIXTURE_ROOT, adrDir: 'adr' });
    expect(result.main_index.version).toBe('0.1');
    expect(result.main_index.sections.adr.count).toBe(3);
    expect(result.main_index.sections.adr.body_ref).toBe('.shirokuma/codemap/bodies/adr.json');
    expect(result.bodies.adr.map((e) => e.number)).toEqual(['0001', '0002', '0003']);
  });

  it('OUTPUT_PATHS constant covers both main index and ADR body (POSIX-normalized)', () => {
    expect(OUTPUT_PATHS).toEqual(['.shirokuma/codemap/overview.json', ADR_BODY_PATH]);
    expect(ADR_BODY_PATH).toBe('.shirokuma/codemap/bodies/adr.json');
  });

  it('handles missing adr directory gracefully (count: 0)', () => {
    const result = buildCodemap({ projectPath: FIXTURE_ROOT, adrDir: 'nope' });
    expect(result.main_index.sections.adr.count).toBe(0);
    expect(result.bodies.adr).toEqual([]);
  });
});

describe('writeBuildResult', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'codemap-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('writes main index + body to disk with trailing newline', () => {
    const result = buildCodemap({ projectPath: FIXTURE_ROOT, adrDir: 'adr' });
    writeBuildResult(tmp, result);

    const mainRaw = readFileSync(join(tmp, MAIN_INDEX_PATH), 'utf8');
    expect(mainRaw.endsWith('\n')).toBe(true);
    const main = JSON.parse(mainRaw) as { sections: { adr: { count: number } } };
    expect(main.sections.adr.count).toBe(3);

    const bodyRaw = readFileSync(join(tmp, ADR_BODY_PATH), 'utf8');
    const body = JSON.parse(bodyRaw) as Array<{ number: string }>;
    expect(body.map((e) => e.number)).toEqual(['0001', '0002', '0003']);
  });

  it('is idempotent: second write overwrites cleanly', () => {
    const result = buildCodemap({ projectPath: FIXTURE_ROOT, adrDir: 'adr' });
    writeBuildResult(tmp, result);
    writeBuildResult(tmp, result);
    const mainRaw = readFileSync(join(tmp, MAIN_INDEX_PATH), 'utf8');
    expect(JSON.parse(mainRaw)).toBeTruthy();
  });
});
