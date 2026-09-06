import { flushPromises, mount } from '@vue/test-utils';

import { Tag } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import OpButtonEditor from '../op-button-editor.vue';


const reviewApprovePermission = 'module:resource:review:approve';
const reviewQueryPermission = 'module:resource:review:query';

vi.mock(
  '@levin/admin-framework/framework-commons/app/api/rbac-service',
  () => ({
    rbacService: {
      fetchAuthorizedPermissionTree: vi.fn().mockResolvedValue([
        {
          children: [
            {
              children: [
                {
                  id: 'approve',
                  label: '审核',
                  name: '审核',
                  nodeType: 'Action',
                  permissionExpr: 'module:resource:review:approve',
                },
                {
                  id: 'query',
                  label: '查询',
                  name: '查询',
                  nodeType: 'Action',
                  permissionExpr: 'module:resource:review:query',
                },
              ],
              id: 'review',
              label: '团队',
              name: '团队',
              nodeType: 'Resource',
            },
          ],
          id: 'module',
          label: '基础模块',
          name: '基础模块',
          nodeType: 'Module',
        },
      ]),
    },
  }),
);
vi.mock(
  '@levin/admin-framework/framework-commons/shared/resource-permission-tree-editor.vue',
  () => ({
    default: {
      name: 'ResourcePermissionTreeEditor',
      props: ['permissionTree', 'selectionMode', 'value'],
      template: '<div />',
    },
  }),
);

function mountEditor() {
  return mount(OpButtonEditor, {
    props: {
      value: [
        {
          label: '审核',
          opName: 'review',
          requireAuthorizations: [
            reviewApprovePermission,
            reviewQueryPermission,
          ],
        },
      ],
    },
  });
}

describe('菜单操作权限编辑', () => {
  it('资源权限编辑器明确采用多选模式并保留多个权限表达式', () => {
    const wrapper = mountEditor();

    expect(wrapper.text()).toContain('可多选');
    expect(wrapper.props('value')?.[0]?.requireAuthorizations).toEqual([
      reviewApprovePermission,
      reviewQueryPermission,
    ]);
    wrapper.unmount();
  });

  it('不显示 API 地址列和地址输入框', () => {
    const wrapper = mountEditor();

    expect(wrapper.findAll('th').map((header) => header.text())).not.toContain(
      'API地址',
    );
    expect(wrapper.find('input[placeholder="请输入API地址"]').exists()).toBe(
      false,
    );
    wrapper.unmount();
  });

  it('修改显示名称时保留多选资源权限且不修改传入对象', async () => {
    const wrapper = mountEditor();

    await wrapper
      .find('input[placeholder="请输入显示名称"]')
      .setValue('审核操作');

    expect(wrapper.emitted('update:value')?.at(-1)).toEqual([
      [
        {
          label: '审核操作',
          opName: 'review',
          requireAuthorizations: [
            reviewApprovePermission,
            reviewQueryPermission,
          ],
        },
      ],
    ]);
    expect(wrapper.props('value')?.[0]?.label).toBe('审核');
    wrapper.unmount();
  });

  it('允许单独移除一个已选资源权限', async () => {
    const wrapper = mountEditor();
    await flushPromises();

    expect(
      wrapper
        .get(
          '[data-test="operation-resource-permission-0-module:resource:review:approve"]',
        )
        .text(),
    ).toBe('基础模块 / 团队 / 审核');
    expect(
      wrapper
        .get(
          '[data-test="operation-resource-permission-0-module:resource:review:approve"]',
        )
        .attributes('title'),
    ).toBe('module:resource:review:approve');

    const tag = wrapper
      .findAllComponents(Tag)
      .find(
        (item) =>
          item.attributes('data-test') ===
          'operation-resource-permission-0-module:resource:review:approve',
      );
    expect(tag).toBeDefined();
    tag?.vm.$emit('close');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:value')?.at(-1)).toEqual([
      [
        {
          label: '审核',
          opName: 'review',
          requireAuthorizations: ['module:resource:review:query'],
        },
      ],
    ]);
    wrapper.unmount();
  });
});
