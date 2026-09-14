import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataPermissionDialog from '../data-permission-dialog.vue';

const mocks = vi.hoisted(() => ({
  domainOptions: vi.fn().mockResolvedValue([]),
  get: vi.fn(),
  put: vi.fn(),
  superAdmin: true,
}));
vi.mock('@vben/stores', () => ({ useUserStore: () => ({ userInfo: {} }) }));
vi.mock('../user-identity', () => ({
  isSuperAdminUser: () => mocks.superAdmin,
}));
vi.mock('../../runtime', () => ({
  requestClient: { get: mocks.get, put: mocks.put },
}));
vi.mock('../../app/api/rbac-service', () => ({
  rbacService: { fetchAuthorizedOrgTree: vi.fn().mockResolvedValue([]) },
}));
const tenantDataScopeOptionsLoader = vi.hoisted(() =>
  vi.fn().mockResolvedValue([]),
);
vi.mock('../config-helpers', () => ({ tenantDataScopeOptionsLoader }));
vi.mock('ant-design-vue', () => {
  const list = Object.assign(
    defineComponent({
      name: 'ListStub',
      props: { dataSource: { default: () => [], type: Array } },
      template:
        '<div><slot v-for="item in dataSource" name="renderItem" :item="item" /></div>',
    }),
    {
      Item: defineComponent({
        name: 'ListItemStub',
        template: '<div><slot /></div>',
      }),
    },
  );
  const tabs = Object.assign(
    defineComponent({ name: 'TabsStub', template: '<div><slot /></div>' }),
    {
      TabPane: defineComponent({
        name: 'TabPaneStub',
        template: '<section><slot name="tab" /><slot /></section>',
      }),
    },
  );
  return {
    Alert: defineComponent({ template: '<div><slot /></div>' }),
    Badge: defineComponent({
      props: { count: [Number, String] },
      template: '<i><slot />{{ count }}</i>',
    }),
    Button: defineComponent({
      props: { disabled: Boolean },
      emits: ['click'],
      template:
        '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    }),
    Checkbox: defineComponent({
      name: 'CheckboxStub',
      props: { checked: Boolean, disabled: Boolean },
      emits: ['update:checked'],
      template:
        '<label><input :checked="checked" :disabled="disabled" type="checkbox" @change="$emit(\'update:checked\', !checked)" /><slot /></label>',
    }),
    Empty: Object.assign(defineComponent({ template: '<div><slot /></div>' }), {
      PRESENTED_IMAGE_SIMPLE: '',
    }),
    Input: Object.assign(defineComponent({ template: '<input />' }), {
      TextArea: defineComponent({ template: '<textarea />' }),
    }),
    List: list,
    Modal: Object.assign(
      defineComponent({
        props: { open: Boolean },
        template: '<div v-if="open"><slot /></div>',
      }),
      { confirm: ({ onOk }: { onOk: () => void }) => onOk() },
    ),
    Spin: defineComponent({ template: '<div><slot /></div>' }),
    Select: defineComponent({ template: '<div><slot /></div>' }),
    Tag: defineComponent({ template: '<span><slot /></span>' }),
    Tabs: tabs,
    Tooltip: defineComponent({ template: '<span><slot /></span>' }),
    TreeSelect: defineComponent({ template: '<div><slot /></div>' }),
    message: { success: vi.fn() },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.superAdmin = true;
  mocks.put.mockResolvedValue({});
});

async function openDialog(subjectType: 'role' | 'user') {
  mocks.get.mockResolvedValue({
    id: 'subject-1',
    optimisticLock: 7,
    name: '测试主体',
    domainScopeList: ['domain-allowed'],
    deniedDomainScopeList: ['domain-denied'],
    tenantScopeList: ['tenant-allowed'],
    deniedTenantScopeList: ['tenant-denied'],
    orgScopeList: ['org-allowed|SelfAndAllChild'],
    deniedOrgScopeList: ['org-denied|SelfAndAllChild'],
  });
  const wrapper = mount(DataPermissionDialog, {
    props: {
      loadDomainOptions: mocks.domainOptions,
      open: false,
      record: { id: 'subject-1' },
      subjectType,
    },
  });
  await wrapper.setProps({ open: true });
  await flushPromises();
  return wrapper;
}

describe('数据权限列表管理', () => {
  it('候选弹窗默认加载预设值和对应列表接口候选', async () => {
    const wrapper = await openDialog('role');
    const addButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '添加');
    await addButton?.trigger('click');
    await flushPromises();
    expect(mocks.domainOptions).toHaveBeenCalledWith('');
    wrapper.unmount();
  });
  it('按领域、租户、组织排序并显示允许和拒绝计数角标', async () => {
    const wrapper = await openDialog('role');
    const text = wrapper.text();
    expect(text.indexOf('领域')).toBeLessThan(text.indexOf('租户'));
    expect(text.indexOf('租户')).toBeLessThan(text.indexOf('组织'));
    expect(text).toContain('允许列表');
    expect(text).toContain('拒绝列表');
    expect(
      wrapper.findAll('i').filter((item) => /^1$/.test(item.text())),
    ).toHaveLength(6);
    wrapper.unmount();
  });

  it('角色不显示不设置控件', async () => {
    const wrapper = await openDialog('role');
    expect(wrapper.text()).not.toContain('不设置');
    wrapper.unmount();
  });

  it('非超级管理员不显示租户配置 Tab', async () => {
    mocks.superAdmin = false;
    const wrapper = await openDialog('role');
    expect(wrapper.text()).not.toContain('租户');
    wrapper.unmount();
  });

  it('非超级管理员不能编辑包含 Groovy 的组织范围', async () => {
    mocks.superAdmin = false;
    const wrapper = mount(DataPermissionDialog, {
      props: {
        open: false,
        previewPayload: {
          detail: { orgScopeList: ['root|Groovy#true'] },
          orgTree: [],
        },
        record: { id: 'subject-1' },
        subjectType: 'user',
      },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    expect(
      wrapper
        .findAll('button')
        .filter((button) => ['不设置', '添加'].includes(button.text()))
        .some((button) => button.attributes('disabled') !== undefined),
    ).toBe(true);
    wrapper.unmount();
  });

  it('组织规则会按起点根组织与匹配模式回显', async () => {
    const wrapper = mount(DataPermissionDialog, {
      props: {
        loadDomainOptions: mocks.domainOptions,
        open: false,
        previewPayload: {
          detail: {
            deniedOrgScopeList: ['_ALL_ROOT_|DirectChild'],
            orgScopeList: [
              '_DEFAULT_|SelfAndDirectChild',
              '_DEFAULT_|SelfAndAllChild',
              '_NONE_|Self',
            ],
          },
          orgTree: [],
        },
        record: { id: 'subject-1' },
        subjectType: 'role',
      },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    expect(wrapper.text()).toContain('默认组织');
    expect(wrapper.text()).toContain('自身及直接下级');
    expect(wrapper.text()).toContain('自身及全部下级');
    expect(wrapper.text()).toContain('全部根组织');
    expect(wrapper.text()).toContain('仅直接下级');
    expect(wrapper.text()).toContain('无组织');
    wrapper.unmount();
  });

  it('租户和领域预设规则会按原始语义还原展示', async () => {
    const wrapper = mount(DataPermissionDialog, {
      props: {
        open: false,
        previewPayload: {
          detail: {
            deniedDomainScopeList: ['_NONE_'],
            deniedTenantScopeList: ['_NONE_'],
            domainScopeList: ['_ALL_'],
            tenantScopeList: ['_DEFAULT_', '_ALL_'],
          },
          orgTree: [],
        },
        record: { id: 'subject-1' },
        subjectType: 'role',
      },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('默认租户');
    expect(text).toContain('全部租户');
    expect(text).toContain('无租户');
    expect(text).toContain('全部领域');
    expect(text).toContain('无领域');
    wrapper.unmount();
  });

  it('预设规则与静态领域 ID 混合时保留预设并还原静态名称', async () => {
    mocks.domainOptions.mockResolvedValueOnce([
      { label: '验收领域 A', value: 'domain-a' },
    ]);
    mocks.get.mockResolvedValue({
      deniedDomainScopeList: [],
      domainScopeList: ['_ALL_', 'domain-a'],
      id: 'subject-1',
      orgScopeList: [],
      tenantScopeList: [],
    });
    const wrapper = mount(DataPermissionDialog, {
      props: {
        loadDomainOptions: mocks.domainOptions,
        open: false,
        record: { id: 'subject-1' },
        subjectType: 'role',
      },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();

    expect(wrapper.text()).toContain('全部领域');
    expect(wrapper.text()).toContain('验收领域 A');
    expect(wrapper.text()).not.toContain('domain-a');
    wrapper.unmount();
  });

  it('用户取消领域自定义时只提交领域允许和拒绝字段的 null', async () => {
    const wrapper = await openDialog('user');
    const unsetCheckboxes = wrapper.findAllComponents({ name: 'CheckboxStub' });
    expect(unsetCheckboxes).toHaveLength(6);
    await unsetCheckboxes[0]?.vm.$emit('update:checked', false);
    await unsetCheckboxes[1]?.vm.$emit('update:checked', false);
    const saveButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '保存');
    await saveButton?.trigger('click');
    await flushPromises();
    expect(mocks.put).toHaveBeenCalledWith(
      '/User/update',
      expect.objectContaining({
        forceUpdateFields: ['domainScopeList', 'deniedDomainScopeList'],
        domainScopeList: null,
        deniedDomainScopeList: null,
        id: 'subject-1',
        optimisticLock: 7,
      }),
    );
    const payload = mocks.put.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('tenantScopeList');
    expect(payload).not.toHaveProperty('orgScopeList');
    wrapper.unmount();
  });

  it('用户重新启用自定义但未选择规则时提交显式空集合而非 null', async () => {
    const wrapper = await openDialog('user');
    const unsetCheckboxes = wrapper.findAllComponents({ name: 'CheckboxStub' });

    // 先取消继承，再重新启用自定义，空列表必须保留为明确配置值。
    await unsetCheckboxes[0]?.vm.$emit('update:checked', false);
    await unsetCheckboxes[0]?.vm.$emit('update:checked', true);
    const saveButton = wrapper.findAll('button').find((button) => button.text() === '保存');
    await saveButton?.trigger('click');
    await flushPromises();

    expect(mocks.put).toHaveBeenCalledWith(
      '/User/update',
      expect.objectContaining({
        domainScopeList: [],
        forceUpdateFields: ['domainScopeList'],
        id: 'subject-1',
      }),
    );
    wrapper.unmount();
  });

  it('用户更新允许领域时保留未修改的拒绝领域配置', async () => {
    const wrapper = await openDialog('user');
    const unsetCheckboxes = wrapper.findAllComponents({ name: 'CheckboxStub' });

    // 只将允许字段切换为显式空范围；拒绝字段保持原始值且不参与本次更新。
    await unsetCheckboxes[0]?.vm.$emit('update:checked', false);
    await unsetCheckboxes[0]?.vm.$emit('update:checked', true);
    const saveButton = wrapper.findAll('button').find((button) => button.text() === '保存');
    await saveButton?.trigger('click');
    await flushPromises();

    const payload = mocks.put.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({ domainScopeList: [] });
    expect(payload).not.toHaveProperty('deniedDomainScopeList');
    expect(payload.forceUpdateFields).toEqual(['domainScopeList']);
    wrapper.unmount();
  });
});
