import { describe, expect, it } from 'vitest';

import {
  compactOpenAreaCodeList,
  filterOpenAreaTree,
  isOpenAreaCodeCovered,
  normalizeOpenAreaCodeList,
  shouldFilterOpenAreaTree,
  toggleOpenAreaCode,
} from '../open-area-code-tree-selection';

describe('open area code tree selection', () => {
  const sampleAreas = [
    {
      children: [
        {
          children: [
            { code: '130201', level: 'district' as const, name: 'A区' },
            { code: '130202', level: 'district' as const, name: 'B区' },
          ],
          code: '130200',
          level: 'city' as const,
          name: '示例市',
        },
        {
          children: [
            { code: '130301', level: 'district' as const, name: 'C区' },
          ],
          code: '130300',
          level: 'city' as const,
          name: '另一市',
        },
      ],
      code: '130000',
      level: 'province' as const,
      name: '示例省',
    },
  ];

  it('collapses selected child ranges into their selected province or city', () => {
    expect(normalizeOpenAreaCodeList(['330000', '330100', '330106'])).toEqual([
      '330000',
    ]);
    expect(normalizeOpenAreaCodeList(['330100', '330106'])).toEqual(['330100']);
  });

  it('treats selected parent ranges as coverage for all descendants', () => {
    expect(isOpenAreaCodeCovered('330100', '330106')).toBe(true);
    expect(isOpenAreaCodeCovered('330000', '330106')).toBe(true);
    expect(isOpenAreaCodeCovered('330106', '330100')).toBe(false);
  });

  it('removes a covering parent range when a child is unchecked', () => {
    expect(toggleOpenAreaCode(['330100'], '330106', false)).toEqual([]);
  });

  it('compacts complete districts into their city and complete cities into their province', () => {
    expect(compactOpenAreaCodeList(['130201', '130202'], sampleAreas)).toEqual([
      '130200',
    ]);
    expect(
      compactOpenAreaCodeList(['130201', '130202', '130301'], sampleAreas),
    ).toEqual(['130000']);
  });

  it('filters matched names while retaining their province path', () => {
    expect(filterOpenAreaTree(sampleAreas, 'A区')).toMatchObject([
      {
        children: [
          {
            children: [{ code: '130201', name: 'A区' }],
            code: '130200',
          },
        ],
        code: '130000',
      },
    ]);
  });

  it('does not use hierarchy generic terms as fuzzy search keywords', () => {
    expect(shouldFilterOpenAreaTree('省')).toBe(false);
    expect(shouldFilterOpenAreaTree('市')).toBe(false);
    expect(shouldFilterOpenAreaTree('区')).toBe(false);
    expect(shouldFilterOpenAreaTree('唐山')).toBe(true);
  });

  it('keeps unknown historical codes while normalizing known codes', () => {
    expect(normalizeOpenAreaCodeList(['330100', 'legacy-code'])).toEqual([
      '330100',
      'legacy-code',
    ]);
  });
});
