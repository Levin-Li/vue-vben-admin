import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';

import { UserOrgSelector } from '@levin/admin-framework';
import { encodeUserOrgSelectorKey } from '@levin/admin-framework/framework-commons/shared/user-org-selector-utils';
import { TreeSelect } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

describe('工作流宿主使用真实授权组织选择器', () => {
  it('选择授权组织会向宿主发出包含租户归属的记录', async () => {
    const loader = vi.fn(async () => [
      {
        id: 'org-root',
        tenantId: 'tenant-a',
        name: '默认部门',
        type: 'Company',
        children: [],
      },
    ]);
    const wrapper = mount(
      defineComponent({
        components: { UserOrgSelector },
        setup: () => ({ loader, selected: ref<unknown>() }),
        template:
          '<UserOrgSelector :selectable-types="[\'org\']" value-mode="record" :multiple="false" :show-tenant-nodes="true" :load-org-tree="loader" @update:selected-records="selected = $event" />',
      }),
    );
    await vi.waitFor(() =>
      expect(wrapper.findComponent(TreeSelect).exists()).toBe(true),
    );
    wrapper.findComponent(TreeSelect).vm.$emit('dropdownVisibleChange', true);
    await flushPromises();
    wrapper
      .findComponent(TreeSelect)
      .vm.$emit('change', encodeUserOrgSelectorKey('org', 'org-root'));
    await flushPromises();
    expect(wrapper.vm.selected).toEqual([
      expect.objectContaining({
        id: 'org-root',
        kind: 'org',
        tenantId: 'tenant-a',
      }),
    ]);
    wrapper.unmount();
  });

  it('展开加载真实树形契约并保留租户归属', async () => {
    const loader = vi.fn(async () => [
      {
        id: 'org-root',
        tenantId: 'tenant-a',
        name: '默认部门',
        type: 'Company',
        children: [
          {
            id: 'org-child',
            tenantId: 'tenant-a',
            name: '研发中心',
            type: 'Department',
            children: [],
          },
        ],
      },
    ]);
    const wrapper = mount(
      defineComponent({
        components: { UserOrgSelector },
        setup: () => ({ loader }),
        template:
          '<UserOrgSelector :selectable-types="[\'org\']" value-mode="record" :multiple="false" :show-tenant-nodes="true" :load-org-tree="loader" />',
      }),
    );
    await vi.waitFor(() =>
      expect(wrapper.findComponent(TreeSelect).exists()).toBe(true),
    );
    wrapper.findComponent(TreeSelect).vm.$emit('dropdownVisibleChange', true);
    await flushPromises();
    expect(loader).toHaveBeenCalledTimes(1);
    const nodes = wrapper.findComponent(TreeSelect).props('treeData');
    expect(nodes?.[0]?.children?.[0]).toMatchObject({
      id: 'org-root',
      tenantId: 'tenant-a',
      title: '默认部门',
      selectable: true,
    });
    expect(nodes?.[0]?.children?.[0]?.children?.[0]).toMatchObject({
      id: 'org-child',
      tenantId: 'tenant-a',
      selectable: true,
    });
    // 初始只展示折叠的租户根；搜索组织名称会展开匹配节点的全部祖先。
    wrapper.findComponent(TreeSelect).vm.$emit('search', '研发');
    await flushPromises();
    expect(wrapper.findComponent(TreeSelect).props('treeExpandedKeys')).toEqual(
      expect.arrayContaining([nodes?.[0]?.key, nodes?.[0]?.children?.[0]?.key]),
    );
    wrapper.unmount();
  });
});
