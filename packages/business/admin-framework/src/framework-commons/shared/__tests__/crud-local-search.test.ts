import { describe, expect, it } from 'vitest';

import { filterCrudLocalSelectOption } from '../crud-local-search';

describe('standard CRUD local option search', () => {
  it('keeps visible text contains matching', () => {
    const option = { label: '用户管理', value: 'user-management' };

    expect(filterCrudLocalSelectOption('户管', option)).toBe(true);
    expect(filterCrudLocalSelectOption('不存在', option)).toBe(false);
  });

  it('matches full pinyin and pinyin initials by contained fragments', () => {
    const option = { label: '用户管理', value: 'user-management' };

    expect(filterCrudLocalSelectOption('yonghu', option)).toBe(true);
    expect(filterCrudLocalSelectOption('HUGUAN', option)).toBe(true);
    expect(filterCrudLocalSelectOption('yhgl', option)).toBe(true);
    expect(filterCrudLocalSelectOption('HG', option)).toBe(true);
  });

  it('matches English word initials and mixed text', () => {
    expect(
      filterCrudLocalSelectOption('UM', { label: 'User Management' }),
    ).toBe(true);
    expect(
      filterCrudLocalSelectOption('hac', { label: '用户 Admin Center' }),
    ).toBe(true);
    expect(
      filterCrudLocalSelectOption('huadmin', {
        label: '用户 Admin Center',
      }),
    ).toBe(true);
  });

  it('keeps value fallback and accepts empty queries', () => {
    const option = { label: '用户管理', value: 'admin_user' };

    expect(filterCrudLocalSelectOption('ADMIN_USER', option)).toBe(true);
    expect(filterCrudLocalSelectOption('  ', option)).toBe(true);
  });
});
