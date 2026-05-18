import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOOP_LOGGER, createConsoleLogger } from '../../src/context/logger.js';

describe('createConsoleLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes info / warn to console.log and error to console.error', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createConsoleLogger();
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(log).toHaveBeenCalledWith('[info] i');
    expect(log).toHaveBeenCalledWith('[warn] w');
    expect(err).toHaveBeenCalledWith('[error] e');
  });

  it('suppresses debug output when verbose=false', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    createConsoleLogger(false).debug?.('hidden');
    expect(log).not.toHaveBeenCalled();
  });

  it('emits debug when verbose=true', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    createConsoleLogger(true).debug?.('visible');
    expect(log).toHaveBeenCalledWith('[debug] visible');
  });
});

describe('NOOP_LOGGER', () => {
  it('never writes to stdout or stderr', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    NOOP_LOGGER.info('x');
    NOOP_LOGGER.warn('x');
    NOOP_LOGGER.error('x');
    NOOP_LOGGER.debug?.('x');
    expect(log).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });
});
