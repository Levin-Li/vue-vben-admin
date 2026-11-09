import { describe, expect, it } from 'vitest';

import {
  resolveCrudFormMode,
  resolveCrudInitialMode,
} from '../crud-form-initial-mode';

describe('首次填写模式兼容', () => {
  it('区分缺省、旧开启和旧关闭', () => {
    expect(resolveCrudInitialMode()).toBe('auto');
    expect(resolveCrudInitialMode({})).toBe('auto');
    expect(resolveCrudInitialMode({ quickFill: true })).toBe('quick');
    expect(resolveCrudInitialMode({ quickFill: false })).toBe('normal');
  });

  it('显式新设置优先于旧开关', () => {
    expect(
      resolveCrudInitialMode({ initialMode: 'auto', quickFill: false }),
    ).toBe('auto');
    expect(
      resolveCrudInitialMode({ initialMode: 'wizard', quickFill: true }),
    ).toBe('wizard');
  });

  it('新增默认优先简要，再快捷；编辑不自动快捷', () => {
    const base = {
      view: 'create' as const,
      brief: false,
      wizard: false,
      quick: true,
    };
    expect(resolveCrudFormMode(undefined, base)).toMatchObject({
      layout: 'normal',
      compact: 'quick',
    });
    expect(
      resolveCrudFormMode(undefined, { ...base, view: 'edit' }),
    ).toMatchObject({ layout: 'normal', compact: undefined });
    expect(
      resolveCrudFormMode(undefined, { ...base, wizard: true }),
    ).toMatchObject({ layout: 'wizard', compact: 'quick' });
    expect(
      resolveCrudFormMode(undefined, { ...base, brief: true, wizard: true }),
    ).toMatchObject({ layout: 'wizard', compact: 'brief' });
  });

  it('显式向导不足三组直接回普通；旧关闭仍保留已有简要默认', () => {
    const options = {
      view: 'create' as const,
      brief: true,
      wizard: false,
      quick: true,
    };
    expect(
      resolveCrudFormMode({ initialMode: 'wizard' }, options),
    ).toMatchObject({ layout: 'normal', compact: undefined });
    expect(resolveCrudFormMode({ quickFill: false }, options)).toMatchObject({
      layout: 'normal',
      compact: 'brief',
    });
    expect(
      resolveCrudFormMode({ quickFill: false }, { ...options, brief: false }),
    ).toMatchObject({ layout: 'normal', compact: undefined });
    expect(resolveCrudFormMode({ quickFill: true }, options)).toMatchObject({
      layout: 'normal',
      compact: 'quick',
    });
  });
});
