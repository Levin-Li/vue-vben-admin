import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import Page from '../index.vue';

const post = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock('../../../api/_module', () => ({
  oakBaseGet: vi.fn(async (path: string) => {
    if (path === '/Org/list')
      return { items: [{ id: 'org-a', name: '组织甲' }] };
    if (path === '/User/list')
      return { items: [{ id: 'user-a', name: '用户甲' }] };
    return { items: [] };
  }),
  oakBasePost: post,
}));
vi.mock('@levin/admin-framework', () => ({
  UserOrgSelector: {
    name: 'UserOrgSelector',
    props: [
      'selectableTypes',
      'maxSelectCount',
      'orgLoadApi',
      'userLoadApi',
      'modelValue',
    ],
    emits: ['update:modelValue'],
    template: '<div />',
  },
}));

describe('具名范围验收选择器', () => {
  it('限制组织与个人的单选候选并拒绝候选外 ID', async () => {
    const wrapper = mount(Page);
    await flushPromises();
    const [org, user] = wrapper.findAllComponents({ name: 'UserOrgSelector' });
    expect(org?.props('selectableTypes')).toEqual(['org']);
    expect(user?.props('selectableTypes')).toEqual(['user']);
    expect(org?.props('maxSelectCount')).toBe(1);
    expect(user?.props('maxSelectCount')).toBe(1);
    expect(
      await (org?.props('orgLoadApi') as () => Promise<unknown>)(),
    ).toEqual([{ id: 'org-a', name: '组织甲' }]);
    expect(
      await (user?.props('userLoadApi') as () => Promise<unknown>)(),
    ).toEqual([{ id: 'user-a', name: '用户甲' }]);
    org?.vm.$emit('update:modelValue', 'org-a');
    user?.vm.$emit('update:modelValue', 'outside');
    await flushPromises();
    await wrapper.find('form').trigger('submit.prevent');
    expect(post).not.toHaveBeenCalled();
    expect(user?.props('modelValue')).toBeUndefined();
    expect(org?.props('modelValue')).toBe('org-a');
  });
});
