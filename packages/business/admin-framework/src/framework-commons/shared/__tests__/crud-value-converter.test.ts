import { describe, expect, it } from 'vitest';

import {
  convertCrudValue,
  formatCrudExportValue,
} from '../crud-value-converter';

describe('crud value converter', () => {
  it('converts and normalizes date values before import submission', () => {
    expect(convertCrudValue('2026/08/10', 'date')).toBe('2026-08-10');
    expect(convertCrudValue('2026-08-10 09:08', 'datetime')).toBe(
      '2026-08-10T09:08:00',
    );
    expect(convertCrudValue('1', 'number')).toBe(1);
    expect(() => convertCrudValue('2026-02-30', 'date')).toThrow(
      '不是有效日期',
    );
  });

  it('uses the list display by default and applies explicit export conversions', () => {
    expect(formatCrudExportValue(1, undefined, '启用')).toBe('启用');
    expect(formatCrudExportValue(' 42 ', 'number', ' 42 ')).toBe('42');
    expect(formatCrudExportValue('2026-08-10', 'datetime', '2026-08-10')).toBe(
      '2026-08-10T00:00:00',
    );
  });
});
