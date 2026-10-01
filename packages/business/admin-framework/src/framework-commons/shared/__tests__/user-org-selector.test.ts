import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { encodeUserOrgSelectorKey } from '../user-org-selector-utils';
import UserOrgSelector from '../user-org-selector.vue';

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
      'dropdownMatchSelectWidth',
      'loadData',
      'loading',
      'multiple',
      'popupClassName',
      'placeholder',
      'showSearch',
      'search',
      'treeCheckable',
      'treeData',
      'treeExpandedKeys',
      'value',
      'virtual',
    ],
    template: '<div data-test="tree-select"></div>',
  },
  Tree: {
    name: 'Tree',
    props: [
      'treeData',
      'selectedKeys',
      'checkedKeys',
      'expandedKeys',
      'checkable',
      'loadData',
    ],
    template:
      '<div data-test="inline-tree"><slot name="title" v-bind="treeData[0] || {}" /></div>',
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

const treeSelectStub = {
  name: 'TreeSelect',
  props: [
    'allowClear',
    'disabled',
    'dropdownMatchSelectWidth',
    'loadData',
    'loading',
    'multiple',
    'popupClassName',
    'placeholder',
    'showSearch',
    'search',
    'treeCheckable',
    'treeData',
    'treeExpandedKeys',
    'value',
    'virtual',
  ],
  template:
    '<div data-test="tree-select"><slot name="title" v-bind="treeData[0] || {}" /></div>',
};

const iconifyIconStub = {
  name: 'IconifyIcon',
  props: ['icon'],
  template: '<i :data-icon="icon" data-test="node-icon"></i>',
};

const treeStub = {
  name: 'Tree',
  props: [
    'treeData',
    'selectedKeys',
    'checkedKeys',
    'expandedKeys',
    'checkable',
    'loadData',
  ],
  template:
    '<div data-test="inline-tree"><slot name="title" v-bind="treeData[0] || {}" /></div>',
};

function mountSelector(props: Record<string, unknown>) {
  return mount(UserOrgSelector, {
    global: {
      stubs: {
        IconifyIcon: iconifyIconStub,
        TreeSelect: treeSelectStub,
        Tree: treeStub,
      },
    },
    props,
  });
}

async function openSelector(wrapper: ReturnType<typeof mountSelector>) {
  wrapper
    .findComponent(treeSelectStub)
    .vm.$emit('dropdown-visible-change', true);
  await flushPromises();
}

describe('userOrgSelector', () => {
  beforeEach(() => {
    fetchCrudList.mockReset();
    fetchCrudList.mockResolvedValue({ items: [] });
  });

  it('defers organization loading until the user opens the selector', async () => {
    const orgLoadApi = vi.fn(async () => []);
    const wrapper = mountSelector({ orgLoadApi });

    await flushPromises();
    expect(orgLoadApi).not.toHaveBeenCalled();

    await openSelector(wrapper);
    expect(orgLoadApi).toHaveBeenCalledTimes(1);

    await openSelector(wrapper);
    expect(orgLoadApi).toHaveBeenCalledTimes(1);
  });

  it('手机内嵌模式直接显示搜索与候选树，并沿用原有选中记录', async () => {
    const orgLoadApi = vi.fn(async () => [{ id: 'org-1', name: '总部' }]);
    const wrapper = mountSelector({ inline: true, orgLoadApi });

    await flushPromises();

    expect(orgLoadApi).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-test="tree-select"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="inline-tree"]').exists()).toBe(true);

    const search = wrapper.get('input[type="search"]');
    await search.setValue('总部');
    expect(wrapper.findComponent(treeStub).props('treeData')).toEqual([
      expect.objectContaining({ id: 'org-1' }),
    ]);

    wrapper
      .findComponent(treeStub)
      .vm.$emit('select', [encodeUserOrgSelectorKey('org', 'org-1')]);
    await flushPromises();
    expect(wrapper.emitted('update:selectedRecords')?.at(-1)?.[0]).toEqual([
      expect.objectContaining({ id: 'org-1', kind: 'org' }),
    ]);
  });

  it('手机内嵌多选仍遵守选择数量上限', async () => {
    const wrapper = mountSelector({
      inline: true,
      maxSelectCount: 2,
      multiple: true,
      orgLoadApi: vi.fn(async () => [
        { id: 'org-1', name: '组织一' },
        { id: 'org-2', name: '组织二' },
        { id: 'org-3', name: '组织三' },
      ]),
    });
    await flushPromises();

    wrapper
      .findComponent(treeStub)
      .vm.$emit('check', [
        encodeUserOrgSelectorKey('org', 'org-1'),
        encodeUserOrgSelectorKey('org', 'org-2'),
        encodeUserOrgSelectorKey('org', 'org-3'),
      ]);
    await flushPromises();

    expect(wrapper.emitted('update:selectedRecords')?.at(-1)?.[0]).toHaveLength(
      2,
    );
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

    await openSelector(wrapper);

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
    await openSelector(wrapper);

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

    await openSelector(wrapper);

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

    await openSelector(wrapper);
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

  it('softens only disabled organization node titles', async () => {
    const orgLoadApi = vi.fn(async () => [{ id: 'org-1', name: 'Org 1' }]);
    const disabledWrapper = mountSelector({
      allowSelectUser: false,
      mode: 'user',
      orgLoadApi,
      selectableTypes: ['user'],
    });
    const selectableWrapper = mountSelector({
      mode: 'org',
      orgLoadApi,
    });

    await openSelector(disabledWrapper);
    await openSelector(selectableWrapper);

    expect(
      disabledWrapper.get('.user-org-selector__disabled-org-title').text(),
    ).toBe('Org 1');
    expect(
      selectableWrapper.find('.user-org-selector__disabled-org-title').exists(),
    ).toBe(false);
  });

  it('shows organization icons before titles by default and supports hiding them', async () => {
    const orgLoadApi = vi.fn(async () => [
      { id: 'company-1', name: '总部', type: 'Company' },
    ]);
    const defaultWrapper = mountSelector({
      allowSelectUser: false,
      mode: 'org',
      orgLoadApi,
    });
    const textOnlyWrapper = mountSelector({
      allowSelectUser: false,
      mode: 'org',
      orgLoadApi,
      showNodeIcons: false,
    });

    await openSelector(defaultWrapper);
    await openSelector(textOnlyWrapper);

    const icon = defaultWrapper.get('.user-org-selector__node-icon');
    expect(icon.element.nextElementSibling?.textContent).toBe('总部');
    expect(defaultWrapper.get('.user-org-selector__node-title').text()).toBe(
      '总部',
    );
    expect(textOnlyWrapper.find('.user-org-selector__node-icon').exists()).toBe(
      false,
    );
  });

  it('uses a bounded scrolling popup so deep organization titles stay on one line', async () => {
    const wrapper = mountSelector({
      allowSelectUser: false,
      mode: 'org',
      orgLoadApi: vi.fn(async () => [
        { id: 'org-1', name: '这是一个层级很深的组织名称' },
      ]),
    });

    await openSelector(wrapper);

    const treeSelect = wrapper.findComponent(treeSelectStub);
    expect(treeSelect.props()).toMatchObject({
      dropdownMatchSelectWidth: false,
      popupClassName: 'user-org-selector__dropdown',
      virtual: false,
    });
    expect(wrapper.html()).toContain('这是一个层级很深的组织名称');
  });

  it('expands matching organization paths and highlights the search keyword', async () => {
    const wrapper = mountSelector({
      allowSelectUser: false,
      mode: 'org',
      orgLoadApi: vi.fn(async () => [
        {
          children: [
            {
              children: [{ id: 'team', name: '搜索目标团队' }],
              id: 'department',
              name: '研发中心',
            },
          ],
          id: 'root',
          name: '集团总部',
        },
      ]),
    });

    await openSelector(wrapper);

    const treeSelect = wrapper.findComponent(treeSelectStub);
    treeSelect.vm.$emit('search', '目标');
    await flushPromises();

    expect(treeSelect.props('treeExpandedKeys')).toEqual([
      encodeUserOrgSelectorKey('org', 'root'),
      encodeUserOrgSelectorKey('org', 'department'),
    ]);

    treeSelect.vm.$emit('search', '集团');
    await flushPromises();
    expect(wrapper.get('mark').text()).toBe('集团');

    treeSelect.vm.$emit('search', '');
    await flushPromises();
    expect(treeSelect.props('treeExpandedKeys')).toEqual([]);
  });
});
