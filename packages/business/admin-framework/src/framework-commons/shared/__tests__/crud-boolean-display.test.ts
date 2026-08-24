import { describe, expect, it } from 'vitest';

import {
  getCrudBooleanDisplayText,
  getCrudBooleanTagColor,
  isCrudBooleanField,
  isCrudEnableBooleanField,
} from '../crud-boolean-display';

describe('crud boolean list display', () => {
  it('renders ordinary boolean fields as 是 and 否', () => {
    const field = {
      key: 'editable',
      label: '是否可编辑',
      type: 'switch',
      valueType: 'boolean',
    } as const;

    expect(isCrudBooleanField(field)).toBe(true);
    expect(isCrudEnableBooleanField(field)).toBe(false);
    expect(getCrudBooleanDisplayText(field, true)).toBe('是');
    expect(getCrudBooleanDisplayText(field, false)).toBe('否');
    expect(getCrudBooleanTagColor(true)).toBe('green');
    expect(getCrudBooleanTagColor(false)).toBe('default');
  });

  it('keeps 启用 and 是否启用 fields on their business wording', () => {
    const field = {
      key: 'enable',
      label: '是否启用',
      type: 'switch',
      valueType: 'boolean',
    } as const;

    expect(isCrudEnableBooleanField(field)).toBe(true);
    expect(getCrudBooleanDisplayText(field, true)).toBe('启用');
    expect(getCrudBooleanDisplayText(field, false)).toBe('禁用');
  });

  it('does not convert null or non-boolean values into a boolean label', () => {
    const field = {
      key: 'enabled',
      label: '启用',
      valueType: 'boolean',
    } as const;

    expect(getCrudBooleanDisplayText(field, null)).toBeUndefined();
    expect(getCrudBooleanDisplayText(field, 'false')).toBeUndefined();
  });
});
