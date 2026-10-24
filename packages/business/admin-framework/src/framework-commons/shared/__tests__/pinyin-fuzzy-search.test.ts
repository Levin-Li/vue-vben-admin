import { describe, expect, it } from 'vitest';

import { matchesPinyinFuzzySearch } from '../pinyin-fuzzy-search';

describe('matchesPinyinFuzzySearch', () => {
  it('accepts a keyword and original text and returns a boolean', () => {
    expect(matchesPinyinFuzzySearch('户管', '用户管理')).toBe(true);
    expect(matchesPinyinFuzzySearch('yonghu', '用户管理')).toBe(true);
    expect(matchesPinyinFuzzySearch('HG', '用户管理')).toBe(true);
    expect(matchesPinyinFuzzySearch('不存在', '用户管理')).toBe(false);
  });

  it('matches English initials and mixed Chinese-English text', () => {
    expect(matchesPinyinFuzzySearch('um', 'User Management')).toBe(true);
    expect(matchesPinyinFuzzySearch('HAC', '用户 Admin Center')).toBe(true);
    expect(matchesPinyinFuzzySearch('huadmin', '用户 Admin Center')).toBe(true);
  });

  it('treats an empty keyword as matching all original text', () => {
    expect(matchesPinyinFuzzySearch('  ', '用户管理')).toBe(true);
  });
});
