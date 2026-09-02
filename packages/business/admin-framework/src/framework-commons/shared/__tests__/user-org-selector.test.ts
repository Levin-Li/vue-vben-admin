import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchCrudList } = vi.hoisted(() => ({
  fetchCrudList: vi.fn(),
}));

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
  fetchCrudList,
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
  beforeEach(() => {
    fetchCrudList.mockReset();
    fetchCrudList.mockResolvedValue({ items: [] });
  });

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

    let treeData = wrapper
      .findComponent(treeSelectStub)
      .props('treeData') as any[];
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

    const treeData = wrapper
      .findComponent(treeSelectStub)
      .props('treeData') as any[];
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

  it('loads users for the expanded organization without inheriting global context', async () => {
    fetchCrudList.mockResolvedValue({
      items: [{ id: 'user-1', name: 'User 1' }],
    });
    const wrapper = mountSelector({
      mode: 'both',
      orgLoadApi: vi.fn(async () => [{ id: 'org-1', name: 'Org 1' }]),
    });

    await flushPromises();
    await wrapper.findComponent(treeSelectStub).props('loadData')({
      key: encodeUserOrgSelectorKey('org', 'org-1'),
    });
    await flushPromises();

    expect(fetchCrudList).toHaveBeenCalledWith(
      '/User/list',
      expect.objectContaining({ enable: true, orgId: 'org-1' }),
      '',
      { skipGlobalUserOrgContext: true },
    );
    const treeData = wrapper
      .findComponent(treeSelectStub)
      .props('treeData') as any[];
    expect(treeData[0]?.children).toEqual([
      expect.objectContaining({ id: 'user-1', kind: 'user' }),
    ]);
  });
});
