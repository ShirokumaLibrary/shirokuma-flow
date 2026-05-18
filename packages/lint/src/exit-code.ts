export function determineLintExitCode(passed: boolean, strict: boolean): number {
  if (passed) return 0;
  return strict ? 1 : 0;
}

export function setExitCode(code: number): void {
  if (code !== 0) process.exitCode = code;
}

export function isEnoent(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ENOENT';
}
