import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGithubRawUrl,
  fetchGithubSubtreeBySha,
  fetchGithubTreeEntries,
  parseGithubRepoUrl,
  resolveGithubTreeSha,
} from '../../src/context/github.js';

describe('parseGithubRepoUrl', () => {
  it('parses https://github.com/{owner}/{repo}', () => {
    expect(parseGithubRepoUrl('https://github.com/octokit/rest.js')).toEqual({
      owner: 'octokit',
      repo: 'rest.js',
    });
  });

  it('strips trailing .git', () => {
    expect(parseGithubRepoUrl('https://github.com/foo/bar.git')).toEqual({
      owner: 'foo',
      repo: 'bar',
    });
  });

  it('accepts trailing slash', () => {
    expect(parseGithubRepoUrl('https://github.com/foo/bar/')).toEqual({
      owner: 'foo',
      repo: 'bar',
    });
  });

  it('returns null for non-github hosts', () => {
    expect(parseGithubRepoUrl('https://gitlab.com/foo/bar')).toBeNull();
  });

  it('returns null for incomplete URLs', () => {
    expect(parseGithubRepoUrl('https://github.com/foo')).toBeNull();
  });
});

describe('buildGithubRawUrl', () => {
  it('concatenates owner/repo/branch/path', () => {
    expect(buildGithubRawUrl('foo', 'bar', 'main', 'docs/index.md')).toBe(
      'https://raw.githubusercontent.com/foo/bar/main/docs/index.md',
    );
  });
});

describe('GitHub tree API wrappers', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  type FetchMockCall = [RequestInfo | URL, RequestInit | undefined];
  function mockFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
    const calls: FetchMockCall[] = [];
    const impl = vi.fn(async (input: RequestInfo | URL, reqInit?: RequestInit) => {
      calls.push([input, reqInit]);
      return new Response(JSON.stringify(body), {
        status: init.ok === false ? (init.status ?? 500) : 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    globalThis.fetch = impl as unknown as typeof fetch;
    return { impl, calls };
  }

  it('fetchGithubTreeEntries returns the tree and forwards token as Bearer', async () => {
    const mock = mockFetch({ tree: [{ path: 'a.md', type: 'blob' }] });
    const entries = await fetchGithubTreeEntries('foo', 'bar', 'main', { token: 'T' });
    expect(entries).toEqual([{ path: 'a.md', type: 'blob' }]);
    const call = mock.calls[0];
    if (!call) throw new Error('expected fetch to be called');
    const headers = (call[1]?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer T');
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('fetchGithubTreeEntries throws on non-2xx', async () => {
    mockFetch({}, { ok: false, status: 404 });
    await expect(fetchGithubTreeEntries('foo', 'bar', 'main')).rejects.toThrow(/404/);
  });

  it('rejects invalid tree refs before calling fetch', async () => {
    const { impl: spy } = mockFetch({ tree: [] });
    await expect(fetchGithubTreeEntries('foo', 'bar', '../evil')).rejects.toThrow(
      /Invalid tree ref/,
    );
    await expect(fetchGithubTreeEntries('foo', 'bar', 'foo;rm')).rejects.toThrow(
      /Invalid tree ref/,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetchGithubSubtreeBySha validates sha format', async () => {
    const { impl: spy } = mockFetch({ tree: [] });
    await expect(fetchGithubSubtreeBySha('foo', 'bar', 'not-a-sha')).rejects.toThrow(/Invalid SHA/);
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetchGithubSubtreeBySha accepts a 40-char hex sha', async () => {
    mockFetch({ tree: [{ path: 'docs/x.md', type: 'blob', sha: 'a'.repeat(40) }] });
    const entries = await fetchGithubSubtreeBySha(
      'foo',
      'bar',
      '0123456789abcdef0123456789abcdef01234567',
    );
    expect(entries[0]?.path).toBe('docs/x.md');
  });

  it('resolveGithubTreeSha returns entry sha or null', async () => {
    mockFetch({
      tree: [
        { path: 'docs', type: 'tree', sha: 'aabb'.repeat(10) },
        { path: 'src', type: 'tree', sha: 'ccdd'.repeat(10) },
      ],
    });
    expect(await resolveGithubTreeSha('foo', 'bar', 'main', 'docs')).toBe('aabb'.repeat(10));
    mockFetch({ tree: [{ path: 'docs', type: 'tree', sha: 'aabb'.repeat(10) }] });
    expect(await resolveGithubTreeSha('foo', 'bar', 'main', 'missing')).toBeNull();
  });
});
