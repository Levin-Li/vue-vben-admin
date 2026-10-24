import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import ScopeFields from '../scope-fields.vue';

// 选择器边界测试只验证传入公共组件的受控候选，不受公共异步分包加载时机影响。
vi.mock('@levin/admin-framework', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    UserOrgSelector: defineComponent({
      name: 'UserOrgSelector',
      props: {
        selectableTypes: { type: Array, default: () => [] },
        selectedRecords: { type: Array, default: () => [] },
        loadOrgTree: { type: Function, default: undefined },
        loadUsers: { type: Function, default: undefined },
      },
      setup: () => () => h('div'),
    }),
  };
});

describe('动态公共归属字段使用受控标准选择器', () => {
  it('隐藏系统默认技术说明，保留自定义中文说明与业务字段说明', async () => {
    const field = {
      name: 'tenantId',
      title: '租户',
      type: 'STRING',
      source: 'SCOPE',
      referenceType: 'TENANT' as const,
      description: '服务端可信租户范围',
    };
    const wrapper = mount(ScopeFields, {
      props: { field, options: { tenantId: [] } },
    });
    expect(wrapper.text()).not.toContain('服务端可信租户范围');
    await wrapper.setProps({
      field: { ...field, description: '请选择本次业务所属租户' },
    });
    expect(wrapper.text()).toContain('请选择本次业务所属租户');
    await wrapper.setProps({ field: { ...field, source: 'BUSINESS' } });
    expect(wrapper.text()).toContain('服务端可信租户范围');
    wrapper.unmount();
  });
  it('组织使用公共UserOrgSelector并显示服务端实际名称', async () => {
    const wrapper = mount(ScopeFields, {
      props: {
        field: {
          name: 'orgId',
          title: '组织',
          type: 'STRING',
          referenceType: 'ORG',
          source: 'SCOPE',
          nullable: true,
        },
        modelValue: 'org-a',
        options: {
          orgId: [{ id: 'org-a', name: '财务部', tenantId: 'tenant-a' }],
        },
      },
    });
    await flushPromises();
    const selector = wrapper.findComponent({ name: 'UserOrgSelector' });
    expect(selector.exists()).toBe(true);
    expect(selector.props('selectableTypes')).toEqual(['org']);
    expect(selector.props('selectedRecords')).toEqual([
      expect.objectContaining({ id: 'org-a', name: '财务部' }),
    ]);
    expect(await selector.props('loadOrgTree')({})).toEqual([
      { id: 'org-a', name: '财务部', tenantId: 'tenant-a' },
    ]);
    wrapper.unmount();
  });
  it('拥有者候选只加载当前已授权组织的受控用户', async () => {
    const wrapper = mount(ScopeFields, {
      props: {
        field: {
          name: 'ownerId',
          title: '所有者',
          type: 'STRING',
          referenceType: 'USER',
          source: 'SCOPE',
        },
        options: {
          orgId: [{ id: 'org-a', name: '财务部' }],
          ownerId: [
            { id: 'user-a', name: '张会计', orgId: 'org-a' },
            { id: 'user-b', name: '李经理', orgId: 'org-b' },
          ],
        },
      },
    });
    await flushPromises();
    const selector = wrapper.findComponent({ name: 'UserOrgSelector' });
    expect(selector.props('selectableTypes')).toEqual(['user']);
    expect(await selector.props('loadUsers')({ orgId: 'org-a' })).toEqual([
      { id: 'user-a', name: '张会计', orgId: 'org-a' },
    ]);
    wrapper.unmount();
  });
});
