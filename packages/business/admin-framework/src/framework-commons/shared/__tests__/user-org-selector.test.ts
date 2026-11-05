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
      'selectable',
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
    'filterTreeNode',
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
    'selectable',
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

  it('组织树延迟加载完成后展开当前拼音搜索命中的路径', async () => {
    let finishTree!: (items: Record<string, any>[]) => void;
    const orgLoadApi = vi.fn(
      () =>
        new Promise<Record<string, any>[]>((resolve) => {
          finishTree = resolve;
        }),
    );
    const wrapper = mountSelector({ selectableTypes: ['org'], orgLoadApi });
    const tree = wrapper.findComponent(treeSelectStub);
    tree.vm.$emit('dropdown-visible-change', true);
    await wrapper.vm.$nextTick();
    tree.vm.$emit('search', 'xzb');
    finishTree([
      { id: 'root', name: '集团', children: [{ id: 'dept', name: '行政部' }] },
    ]);
    await flushPromises();
    expect(tree.props('treeExpandedKeys')).toContain(
      encodeUserOrgSelectorKey('org', 'root'),
    );
    wrapper.unmount();
  });

  it('搜索等待正在加载的授权组织树并丢弃已过期的搜索', async () => {
    let finishTree!: (items: Record<string, any>[]) => void;
    const orgLoadApi = vi.fn(
      () =>
        new Promise<Record<string, any>[]>((resolve) => {
          finishTree = resolve;
        }),
    );
    const userSearchApi = vi.fn(async ({ keyword }: { keyword: string }) => [
      { id: 'user', name: `${keyword}用户` },
    ]);
    const wrapper = mountSelector({
      selectableTypes: ['user'],
      orgLoadApi,
      userSearchApi,
    });
    const tree = wrapper.findComponent(treeSelectStub);
    tree.vm.$emit('dropdown-visible-change', true);
    await wrapper.vm.$nextTick();
    vi.useFakeTimers();
    tree.vm.$emit('search', '旧');
    await vi.advanceTimersByTimeAsync(300);
    tree.vm.$emit('search', '新');
    await vi.advanceTimersByTimeAsync(300);
    expect(userSearchApi).not.toHaveBeenCalled();
    finishTree([{ id: 'org', name: '组织' }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(orgLoadApi).toHaveBeenCalledTimes(1);
    expect(userSearchApi).toHaveBeenCalledTimes(1);
    expect(userSearchApi).toHaveBeenCalledWith({ orgId: 'org', keyword: '新' });
    vi.useRealTimers();
    wrapper.unmount();
  });

  it('组织范围变化时丢弃正在加载的旧组织树', async () => {
    let finishOld!: (items: Record<string, any>[]) => void;
    const orgLoadApi = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Record<string, any>[]>((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockResolvedValueOnce([{ id: 'new', name: '新组织' }]);
    const wrapper = mountSelector({
      selectableTypes: ['user'],
      rootOrgIdList: ['old'],
      orgLoadApi,
    });
    const tree = wrapper.findComponent(treeSelectStub);
    tree.vm.$emit('dropdown-visible-change', true);
    await wrapper.vm.$nextTick();
    await wrapper.setProps({ rootOrgIdList: ['new'] });
    finishOld([{ id: 'old', name: '旧组织' }]);
    await flushPromises();
    expect(orgLoadApi).toHaveBeenCalledTimes(2);
    expect((tree.props('treeData') as any[]).map((item) => item.id)).toEqual([
      'new',
    ]);
    wrapper.unmount();
  });

  it('搜索未展开的授权组织并丢弃过期结果', async () => {
    let finishOld!: (value: Record<string, any>[]) => void;
    const userSearchApi = vi.fn(({ keyword }: { keyword: string }) =>
      keyword === '旧'
        ? new Promise<Record<string, any>[]>((resolve) => {
            finishOld = resolve;
          })
        : Promise.resolve([
            { id: 'new', name: 'Alice' },
            { id: 'bad', name: '新越权', orgId: 'other' },
          ]),
    );
    const wrapper = mountSelector({
      selectableTypes: ['user'],
      orgLoadApi: async () => [{ id: 'org', name: '组织' }],
      userSearchApi,
    });
    await openSelector(wrapper);
    vi.useFakeTimers();
    const tree = wrapper.findComponent(treeSelectStub);
    tree.vm.$emit('search', '旧');
    await vi.advanceTimersByTimeAsync(300);
    expect(userSearchApi).toHaveBeenCalledWith({ orgId: 'org', keyword: '旧' });
    tree.vm.$emit('search', ' Alice ');
    await vi.advanceTimersByTimeAsync(300);
    expect(userSearchApi).toHaveBeenCalledWith({
      orgId: 'org',
      keyword: 'Alice',
    });
    finishOld([{ id: 'old', name: '旧用户' }]);
    await vi.advanceTimersByTimeAsync(0);
    const data = tree.props('treeData') as any[];
    expect(data[0].children.map((item: any) => item.id)).toEqual(['new']);
    vi.useRealTimers();
    wrapper.unmount();
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

  it('only loads an initial organization ID when explicitly requested', async () => {
    const orgLoadApi = vi.fn(async () => [{ id: 'org-1', name: '总部' }]);
    const wrapper = mountSelector({
      loadOnInitialValue: true,
      modelValue: 'org-1',
      orgLoadApi,
      selectableTypes: ['org'],
      valueMode: 'id',
    });

    await flushPromises();
    expect(orgLoadApi).toHaveBeenCalledTimes(1);
    expect(wrapper.findComponent(treeSelectStub).props('treeData')).toEqual([
      expect.objectContaining({ id: 'org-1', title: '总部' }),
    ]);
    expect(wrapper.findComponent(treeSelectStub).props('value')).toBe(
      encodeUserOrgSelectorKey('org', 'org-1'),
    );
    await openSelector(wrapper);
    expect(orgLoadApi).toHaveBeenCalledTimes(1);
    wrapper
      .findComponent(treeSelectStub)
      .vm.$emit('change', encodeUserOrgSelectorKey('org', 'org-1'));
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('org-1');
  });

  it('loads when a query default organization arrives after mount', async () => {
    const orgLoadApi = vi.fn(async () => [{ id: 'org-1', name: '总部' }]);
    const wrapper = mountSelector({
      loadOnInitialValue: true,
      orgLoadApi,
      selectableTypes: ['org'],
    });
    await flushPromises();
    expect(orgLoadApi).not.toHaveBeenCalled();

    await wrapper.setProps({ modelValue: 'org-1' });
    await flushPromises();
    expect(orgLoadApi).toHaveBeenCalledTimes(1);
    expect(wrapper.findComponent(treeSelectStub).props('treeData')).toEqual([
      expect.objectContaining({ id: 'org-1', title: '总部' }),
    ]);
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

  it('自动展开已设置组织节点的祖先路径', async () => {
    const orgLoadApi = vi.fn(async () => [
      {
        id: 'root',
        name: '总部',
        children: [
          {
            id: 'branch',
            name: '研发中心',
            children: [{ id: 'leaf', name: '项目组' }],
          },
          {
            id: 'other-branch',
            name: '运营中心',
            children: [{ id: 'other-leaf', name: '运营组' }],
          },
        ],
      },
    ]);
    const wrapper = mountSelector({
      autoExpandOrgIds: ['leaf'],
      inline: true,
      orgLoadApi,
      selectableTypes: ['org'],
    });
    await flushPromises();
    expect(wrapper.findComponent(treeStub).props('expandedKeys')).toEqual(
      expect.arrayContaining([
        encodeUserOrgSelectorKey('org', 'root'),
        encodeUserOrgSelectorKey('org', 'branch'),
      ]),
    );
    await wrapper.setProps({ autoExpandOrgIds: ['leaf', 'other-leaf'] });
    expect(wrapper.findComponent(treeStub).props('expandedKeys')).toContain(
      encodeUserOrgSelectorKey('org', 'other-branch'),
    );
  });

  it('节点操作模式复用公共组织树并关闭内置选择', async () => {
    const wrapper = mount(UserOrgSelector, {
      global: {
        stubs: {
          IconifyIcon: iconifyIconStub,
          Tree: treeStub,
          TreeSelect: treeSelectStub,
        },
      },
      props: {
        actionOnly: true,
        inline: true,
        orgLoadApi: vi.fn(async () => [{ id: 'org-1', name: '总部' }]),
      },
      slots: {
        'org-action': ({ node }: { node: { name: string } }) => node.name,
      },
    });
    await flushPromises();

    expect(wrapper.findComponent(treeStub).props('checkable')).toBe(false);
    expect(wrapper.findComponent(treeStub).props('selectable')).toBe(false);
    expect(wrapper.find('[data-test="inline-tree"]').text()).toContain('总部');
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

  it('preserves assembled OrgInfo descendants when expanding existing organizations', async () => {
    const tenantId = 'tenant-1';
    const orgLoadApi = vi.fn(async () => [
      {
        id: 'root',
        name: 'Default department',
        tenantId,
        nodeData: null,
        children: [
          {
            id: 'child',
            name: 'Department',
            tenantId,
            nodeData: null,
            children: [{ id: 'team', name: 'Team', tenantId, children: [] }],
          },
        ],
      },
    ]);
    const wrapper = mountSelector({
      orgLoadApi,
      orgLoadMode: 'all',
      selectableTypes: ['org'],
      showTenantNodes: true,
      valueMode: 'record',
    });
    await openSelector(wrapper);
    const tree = wrapper.findComponent(treeSelectStub);
    for (const id of ['root', 'child']) {
      await tree.props('loadData')({
        key: encodeUserOrgSelectorKey('org', id),
      });
      await flushPromises();
    }
    const tenant = (tree.props('treeData') as any[])[0];
    const root = tenant.children[0];
    const child = root.children[0];
    expect(tenant).toMatchObject({ kind: 'tenant', selectable: false });
    expect(root).toMatchObject({
      id: 'root',
      hasChildren: true,
      isLeaf: false,
    });
    expect(child).toMatchObject({
      id: 'child',
      hasChildren: true,
      isLeaf: false,
    });
    expect(child.children[0]).toMatchObject({
      id: 'team',
      tenantId,
      selectable: true,
    });
    expect(orgLoadApi).toHaveBeenCalledTimes(1);
    expect(fetchCrudList).not.toHaveBeenCalled();
    tree.vm.$emit('change', encodeUserOrgSelectorKey('org', 'team'));
    await flushPromises();
    expect(wrapper.emitted('update:selectedRecords')?.at(-1)?.[0]).toEqual([
      expect.objectContaining({ id: 'team', tenantId, kind: 'org' }),
    ]);
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
      { globalUserOrgContext: { orgIds: ['org-1'] } },
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
    const filter = treeSelect.props('filterTreeNode') as (
      input: string,
      node: { title: string },
    ) => boolean;
    expect(filter('ssmbtd', { title: '搜索目标团队' })).toBe(true);
    expect(filter('不存在', { title: '搜索目标团队' })).toBe(false);
    treeSelect.vm.$emit('search', 'ssmbtd');
    await flushPromises();
    expect(treeSelect.props('treeExpandedKeys')).toContain(
      encodeUserOrgSelectorKey('org', 'department'),
    );
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
