import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import SupportUserSelector from '../support-user-selector.vue';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../../api/user-service', () => ({
  userService: { list: mocks.list },
}));
vi.mock('../support-options', () => ({
  buildSupportUserQuery: (scope: unknown) => ({
    ...(scope as object),
    enable: true,
    pageIndex: 1,
    pageSize: 100,
  }),
}));
vi.mock('@levin/admin-framework', () => ({
  UserOrgSelector: defineComponent({
    name: 'UserOrgSelector',
    props: [
      'modelValue',
      'disabled',
      'multiple',
      'maxSelectCount',
      'selectableTypes',
      'orgLoadApi',
      'userLoadApi',
      'resolveRecords',
    ],
    template: '<div />',
  }),
}));

describe('受理用户选择', () => {
  it('保留受理范围并读取完整分页，回显和多选只使用范围内用户', async () => {
    mocks.list.mockReset();
    mocks.list
      .mockResolvedValueOnce({
        items: [{ id: 'a', realName: '甲' }],
        totals: 2,
      })
      .mockResolvedValueOnce({ items: [{ id: 'b', name: '乙' }], totals: 2 });
    const wrapper = mount(SupportUserSelector, {
      props: { scope: { tenantId: 'tenant', orgId: 'org' }, multiple: true },
    });
    const selector = wrapper.getComponent({ name: 'UserOrgSelector' });
    expect(selector.props('selectableTypes')).toEqual(['user']);
    expect(selector.props('multiple')).toBe(true);
    expect(await selector.props('orgLoadApi')()).toEqual([
      { id: 'org', name: '当前受理组织', tenantId: 'tenant' },
    ]);
    expect(await selector.props('userLoadApi')()).toHaveLength(2);
    expect(mocks.list).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        tenantId: 'tenant',
        orgId: 'org',
        enable: true,
        requireTotals: true,
        pageIndex: 2,
      }),
      { __globalUserOrgContext: { tenantId: 'tenant', orgIds: ['org'] } },
    );
    expect(await selector.props('resolveRecords')(['b', 'outside'])).toEqual([
      expect.objectContaining({ id: 'b', kind: 'user' }),
    ]);
  });

  it('分页不完整时报错，避免静默丢失候选', async () => {
    mocks.list.mockReset();
    mocks.list.mockResolvedValueOnce({ items: [], totals: 1 });
    const wrapper = mount(SupportUserSelector, {
      props: { scope: { tenantId: 'tenant', orgId: 'org' } },
    });
    await expect(
      wrapper.getComponent({ name: 'UserOrgSelector' }).props('userLoadApi')(),
    ).rejects.toThrow('用户列表未完整加载');
  });
});
