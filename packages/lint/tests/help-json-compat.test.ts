/**
 * commander v12/v14 互換スモークテスト
 *
 * Step 1 (ADR-v3-019): help-json.ts が利用する commander API が
 * v12（本パッケージ）と v14（flow/markdown）の両方で動作することを検証する。
 */
import { describe, it, expect } from 'vitest';
import { Command, Option } from 'commander';

describe('commander v12 互換: help-json.ts が使用する API', () => {
  it('Option.isBoolean() が真偽値オプションで true を返す', () => {
    const cmd = new Command();
    cmd.option('--flag', 'boolean flag');
    const opt = cmd.options[0];
    // isBoolean() は v12 / v14 両方で利用可能
    expect(typeof opt.isBoolean).toBe('function');
    expect(opt.isBoolean()).toBe(true);
  });

  it('Option.isBoolean() が値取りオプションで false を返す', () => {
    const cmd = new Command();
    cmd.option('--locale <locale>', 'locale option');
    const opt = cmd.options[0];
    expect(opt.isBoolean()).toBe(false);
  });

  it('Command.aliases() が配列を返す', () => {
    const parent = new Command();
    const sub = parent.command('list', { isDefault: false }).alias('ls');
    // aliases() は v12 / v14 両方で利用可能
    expect(typeof sub.aliases).toBe('function');
    const aliases = sub.aliases();
    expect(Array.isArray(aliases)).toBe(true);
    expect(aliases).toContain('ls');
  });

  it('Command.registeredArguments が配列を返す', () => {
    const cmd = new Command();
    cmd.argument('<number>', 'issue number');
    // registeredArguments は v12 / v14 両方で利用可能
    expect(Array.isArray(cmd.registeredArguments)).toBe(true);
    expect(cmd.registeredArguments).toHaveLength(1);
    expect(cmd.registeredArguments[0].name()).toBe('number');
    expect(cmd.registeredArguments[0].required).toBe(true);
  });

  it('Option.long / Option.short が正しく取得できる', () => {
    const opt = new Option('-n, --name <value>', 'name');
    expect(opt.long).toBe('--name');
    expect(opt.short).toBe('-n');
  });

  it('Option.defaultValue が設定値を返す', () => {
    const cmd = new Command();
    cmd.option('--format <format>', 'output format', 'json');
    const opt = cmd.options[0];
    expect(opt.defaultValue).toBe('json');
  });

  it('Command.parent が正しく設定される', () => {
    const parent = new Command('root');
    const child = parent.command('child');
    expect(child.parent).toBe(parent);
  });
});
