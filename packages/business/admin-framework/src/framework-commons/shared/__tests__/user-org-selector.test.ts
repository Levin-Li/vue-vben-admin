import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

vi.mock('ant-design-vue', () => ({
  message: {
    error: vi.fn(),
    warning: vi.fn(),
  },
  TreeSelect: {
    name: 'TreeSelect',
    props: [
      'allowClear',
      'disabled',
      'loadData',
      'loading',
      'multiple',
      'placeholder',
      'showSearch',
      'treeCheckable',
      'treeData',
      'treeExpandedKeys',
      'value',
    ],
    template: '<div data-test="tree-select"></div>',
  },
}));

vi.mock('../../api', () => ({
  fetchCrudList: vi.fn(async () => ({ items: [] })),
}));

vi.mock('../../app/api/rbac-service', () => ({
  rbacService: {
    fetchAuthorizedOrgTree: vi.fn(async () => []),
  },
}));

import UserOrgSelector from '../user-org-selector.vue';
import { encodeUserOrgSelectorKey } from '../user-org-selector-utils';

const treeSelectStub = {
  name: 'TreeSelect',
  props: [
    'allowClear',
    'disabled',
    'loadData',
    'loading',
    'multiple',
    'placeholder',
    'showSearch',
    'treeCheckable',
    'treeData',
    'treeExpandedKeys',
    'value',
  ],
  template: '<div data-test="tree-select"></div>',
};

function mountSelector(props: Record<string, unknown>) {
  return mount(UserOrgSelector, {
    global: {
      stubs: {
        TreeSelect: treeSelectStub,
      },
    },
    props,
  });
}

describe('UserOrgSelector', () => {
  it('keeps unloaded lazy org nodes expandable and marks empty nodes as leaf after load attempt', async () => {
    const orgLoadApi = vi.fn(async ({ parentOrgId }) => {
      if (!parentOrgId) {
        return [
          {
            id: 'root',
            name: 'Root',
          },
        ];
      }

      return [];
    });

    const wrapper = mountSelector({
      allowSelectUser: false,
      mode: 'org',
      orgLoadApi,
      orgLoadMode: 'lazy',
    });

    await flushPromises();

    let treeData = wrapper.findComponent(treeSelectStub).props('treeData') as any[];
    expect(treeData[0]).toMatchObject({
      id: 'root',
      isLeaf: false,
      loadAttempted: false,
    });

    await wrapper.findComponent(treeSelectStub).props('loadData')({
      key: encodeUserOrgSelectorKey('org', 'root'),
    });
    await flushPromises();

    treeData = wrapper.findComponent(treeSelectStub).props('treeData') as any[];
    expect(orgLoadApi).toHaveBeenCalledTimes(2);
    expect(treeData[0]).toMatchObject({
      hasChildren: false,
      isLeaf: true,
      loadAttempted: true,
    });
    expect(treeData[0].children).toEqual([]);
  });

  it('loads lazy organization children once and records parent context', async () => {
    const orgLoadApi = vi.fn(async ({ parentOrgId }) => {
      if (!parentOrgId) {
        return [
          {
            id: 'root',
            name: 'Root',
          },
        ];
      }

      return [
        {
          id: 'child',
          name: 'Child',
        },
      ];
    });

    const wrapper = mountSelector({
      allowSelectUser: false,
      mode: 'org',
      orgLoadApi,
      orgLoadMode: 'lazy',
    });

    await flushPromises();

    await wrapper.findComponent(treeSelectStub).props('loadData')({
      key: encodeUserOrgSelectorKey('org', 'root'),
    });
    await flushPromises();
    await wrapper.findComponent(treeSelectStub).props('loadData')({
      key: encodeUserOrgSelectorKey('org', 'root'),
    });
    await flushPromises();

    const treeData = wrapper.findComponent(treeSelectStub).props('treeData') as any[];
    expect(orgLoadApi).toHaveBeenCalledTimes(2);
    expect(orgLoadApi.mock.calls[1]?.[0]).toMatchObject({
      depth: 2,
      parentOrgId: 'root',
    });
    expect(treeData[0]).toMatchObject({
      hasChildren: true,
      isLeaf: false,
      loadAttempted: true,
    });
    expect(treeData[0].children?.[0]).toMatchObject({
      id: 'child',
      isLeaf: false,
      loadAttempted: false,
    });
  });
});
