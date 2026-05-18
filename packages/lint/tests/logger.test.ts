import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOOP_LOGGER, createConsoleLogger } from '../src/logger.js';

describe('NOOP_LOGGER', () => {
  it('provides all methods and throws on none', () => {
    expect(() => {
      NOOP_LOGGER.info('x');
      NOOP_LOGGER.warn('x');
      NOOP_LOGGER.error('x');
      NOOP_LOGGER.debug?.('x');
    }).not.toThrow();
  });
});

describe('createConsoleLogger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('info / warn / error route to console', () => {
    const logger = createConsoleLogger(false);
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(console.log).toHaveBeenCalledWith('[info] i');
    expect(console.log).toHaveBeenCalledWith('[warn] w');
    expect(console.error).toHaveBeenCalledWith('[error] e');
  });

  it('debug only fires when verbose=true', () => {
    const quiet = createConsoleLogger(false);
    quiet.debug?.('d');
    expect(console.log).not.toHaveBeenCalledWith('[debug] d');

    const loud = createConsoleLogger(true);
    loud.debug?.('d');
    expect(console.log).toHaveBeenCalledWith('[debug] d');
  });
});
