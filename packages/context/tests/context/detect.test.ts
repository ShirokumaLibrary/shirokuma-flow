import { describe, expect, it } from 'vitest';
import { detectFromPackageJson } from '../../src/context/detect.js';

describe('detectFromPackageJson', () => {
  it('returns empty when package.json has no dependencies', () => {
    expect(detectFromPackageJson({})).toEqual([]);
  });

  it('matches single-package presets (react-19 via react)', () => {
    const detected = detectFromPackageJson({
      dependencies: { react: '^19.0.0' },
    });
    const names = detected.map((d) => d.preset);
    expect(names).toContain('react-19');
  });

  it('matches via devDependencies and peerDependencies', () => {
    const fromDev = detectFromPackageJson({ devDependencies: { vitest: '^4.0.0' } });
    expect(fromDev.map((d) => d.preset)).toContain('vitest-4');

    const fromPeer = detectFromPackageJson({ peerDependencies: { typescript: '^5.0.0' } });
    expect(fromPeer.map((d) => d.preset)).toContain('typescript-5');
  });

  it('reports matchedPackages when a preset declares multiple names', () => {
    const detected = detectFromPackageJson({
      dependencies: { react: '^19', 'react-dom': '^19' },
    });
    const react = detected.find((d) => d.preset === 'react-19');
    expect(react?.matchedPackages).toEqual(['react', 'react-dom']);
  });

  it('skips presets without packageNames (e.g. aws-cli-2)', () => {
    const detected = detectFromPackageJson({ dependencies: { 'aws-cli-2': '*' } });
    expect(detected.map((d) => d.preset)).not.toContain('aws-cli-2');
  });

  it('returns multiple presets when unrelated packages match', () => {
    const detected = detectFromPackageJson({
      dependencies: { next: '^16', drizzle: '*' },
      devDependencies: { 'drizzle-orm': '^0.30' },
    });
    const names = detected.map((d) => d.preset);
    expect(names).toContain('nextjs-16');
    expect(names).toContain('drizzle-0');
  });

  it('ignores non-object dependency fields defensively', () => {
    const detected = detectFromPackageJson({
      // @ts-expect-error intentional malformed shape
      dependencies: 'not-an-object',
    });
    expect(detected).toEqual([]);
  });
});
