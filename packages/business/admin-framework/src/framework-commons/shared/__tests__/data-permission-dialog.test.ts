import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataPermissionDialog from '../data-permission-dialog.vue';

const mocks = vi.hoisted(() => ({
  domainOptions: vi.fn().mockResolvedValue([]),
  get: vi.fn(),
  platformUser: false,
  put: vi.fn(),
  superAdmin: true,
}));
vi.mock('@vben/runtime/hooks', () => ({
  useAppConfig: () => ({ apiURL: '/com.levin.oak.base/V1/api' }),
}));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: {} }),
}));
vi.mock('../user-identity', () => ({
  isPlatformUser: () => mocks.superAdmin || mocks.platformUser,
  isSuperAdminUser: () => mocks.superAdmin,
  isTenantAdminUser: () => mocks.superAdmin,
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
vi.mock('../user-org-selector.vue', () => ({
  default: defineComponent({
    name: 'UserOrgSelectorStub',
    template:
      '<div data-testid="shared-org-tree"><slot name="org-action" :node="{ id: \'org-allowed\', name: \'已授权组织\', kind: \'org\' }" /></div>',
  }),
}));
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
    Alert: defineComponent({
      props: { message: String },
      template: '<div>{{ message }}<slot /></div>',
    }),
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
        template:
          '<div v-if="open"><slot name="title" /><slot /><slot name="footer" /></div>',
      }),
      { confirm: ({ onOk }: { onOk: () => void }) => onOk() },
    ),
    Spin: defineComponent({ template: '<div><slot /></div>' }),
    Select: defineComponent({
      props: {
        disabled: Boolean,
        options: { default: () => [], type: Array },
        value: { default: '', type: String },
      },
      emits: ['update:value'],
      template:
        '<select :disabled="disabled" :value="value" @change="$emit(\'update:value\', $event.target.value)"><option value="" disabled>选择匹配模式</option><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
    }),
    Segmented: defineComponent({
      name: 'SegmentedStub',
      props: {
        disabled: Boolean,
        options: { default: () => [], type: Array },
        value: String,
      },
      emits: ['change'],
      template:
        '<div role="radiogroup"><button v-for="option in options" :key="option.value" type="button" :disabled="disabled" :aria-pressed="value === option.value" @click="$emit(\'change\', option.value)">{{ option.label }}</button></div>',
    }),
    Tag: defineComponent({ template: '<span><slot /></span>' }),
    Tabs: tabs,
    Tooltip: defineComponent({ template: '<span><slot /></span>' }),
    TreeSelect: defineComponent({ template: '<div><slot /></div>' }),
    Switch: defineComponent({
      name: 'SwitchStub',
      props: { checked: Boolean, disabled: Boolean },
      emits: ['update:checked'],
      template:
        '<button role="switch" type="button" :disabled="disabled" :aria-checked="checked" @click="$emit(\'update:checked\', !checked)"></button>',
    }),
    message: { success: vi.fn() },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platformUser = false;
  mocks.superAdmin = true;
  mocks.put.mockResolvedValue({});
  mocks.domainOptions.mockResolvedValue([]);
  tenantDataScopeOptionsLoader.mockResolvedValue([]);
});

async function openDialog(
  subjectType: 'role' | 'user',
  detailOverrides: Record<string, unknown> = {},
) {
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
    ...detailOverrides,
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

describe('数据权限候选三档分配', () => {
  function choice(
    wrapper: ReturnType<typeof mount>,
    label: string,
    text: string,
  ) {
    return wrapper
      .find(`[aria-label="${label}访问设置"]`)
      .findAll('button')
      .find((button) => button.text() === text);
  }

  it('固定与动态候选共用滚动框，搜索直接展示', async () => {
    mocks.domainOptions.mockResolvedValueOnce([
      { label: '支付领域', value: 'domain-pay' },
    ]);
    tenantDataScopeOptionsLoader.mockResolvedValueOnce([
      { label: '甲租户', value: 'tenant-a' },
    ]);
    const wrapper = await openDialog('role');
    const domain = wrapper.find('section:first-of-type');
    const options = domain.find('.data-permission-options-scroll');
    expect(options.exists()).toBe(true);
    expect(options.text().indexOf('选项')).toBeLessThan(
      options.text().indexOf('支付领域'),
    );
    expect(options.find('input').exists()).toBe(true);
    expect(options.text()).not.toContain('更多领域候选项');
    expect(domain.text()).toContain('支付领域');
    expect(wrapper.text()).toContain('甲租户');
    expect(
      choice(wrapper, '支付领域', '未设置')?.attributes('aria-pressed'),
    ).toBe('true');
    expect(wrapper.find('[data-testid="shared-org-tree"]').exists()).toBe(true);
    const org = wrapper.find('section:nth-of-type(3)');
    expect(org.findAll('table tbody tr')).toHaveLength(3);
    expect(org.find('table').text()).not.toContain('已授权组织');
    expect(org.find('[data-testid="shared-org-tree"]').exists()).toBe(true);
    expect(org.find('[aria-label="已授权组织子组织匹配模式"]').exists()).toBe(
      true,
    );
    expect(org.text()).not.toContain('添加特殊组织规则');
    expect(org.find('[data-testid="org-special-rules"]').exists()).toBe(false);
    expect(org.text()).not.toContain('特殊组织匹配规则');
    expect(
      wrapper.find('[data-testid="data-permission-footer"]').exists(),
    ).toBe(true);
    expect(
      options.find('[data-testid="data-permission-footer"]').exists(),
    ).toBe(false);
    wrapper.unmount();
  });

  it('各标签不显示常驻规则说明和全量模式说明', async () => {
    const wrapper = await openDialog('role');
    expect(wrapper.text()).not.toContain('每个领域候选项选择');
    expect(wrapper.text()).not.toContain('每个租户候选项选择');
    expect(wrapper.text()).not.toContain('每个组织候选项选择');
    expect(wrapper.text()).toContain('匹配所有领域的数据');

    await choice(wrapper, '全部领域', '允许')?.trigger('click');
    expect(wrapper.text()).not.toContain('其它候选暂时收起');
    wrapper.unmount();
  });

  it('同一领域候选选择拒绝后只写入禁止列表', async () => {
    const wrapper = await openDialog('role');
    await choice(wrapper, 'domain-allowed', '禁止')?.trigger('click');
    const save = wrapper
      .findAll('button')
      .find((button) => button.text() === '保存');
    await save?.trigger('click');
    await flushPromises();
    expect(mocks.put).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/Role/update',
      expect.objectContaining({
        domainScopeList: [],
        deniedDomainScopeList: ['domain-allowed', 'domain-denied'],
      }),
      expect.anything(),
    );
    wrapper.unmount();
  });

  it('默认档从允许和拒绝两侧移除本项规则', async () => {
    const wrapper = await openDialog('role');
    await choice(wrapper, 'domain-allowed', '禁止')?.trigger('click');
    await choice(wrapper, 'domain-allowed', '未设置')?.trigger('click');
    const save = wrapper
      .findAll('button')
      .find((button) => button.text() === '保存');
    await save?.trigger('click');
    await flushPromises();
    expect(mocks.put).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/Role/update',
      expect.objectContaining({
        domainScopeList: [],
        forceUpdateFields: ['domainScopeList'],
      }),
      expect.anything(),
    );
    wrapper.unmount();
  });

  it('全部候选选允许后收起其它项，切回默认恢复草稿', async () => {
    const wrapper = await openDialog('role');
    await choice(wrapper, '全部领域', '允许')?.trigger('click');
    const domain = wrapper.find('section:first-of-type');
    expect(domain.find('input').exists()).toBe(false);
    expect(wrapper.find('[aria-label="domain-allowed访问设置"]').exists()).toBe(
      false,
    );
    await choice(wrapper, '全部领域', '未设置')?.trigger('click');
    expect(
      choice(wrapper, 'domain-allowed', '允许')?.attributes('aria-pressed'),
    ).toBe('true');
    wrapper.unmount();
  });

  it('组织公共树节点使用同样的三档开关', async () => {
    const wrapper = await openDialog('role');
    expect(
      choice(wrapper, '已授权组织', '允许')?.attributes('aria-pressed'),
    ).toBe('true');
    await choice(wrapper, '已授权组织', '禁止')?.trigger('click');
    const save = wrapper
      .findAll('button')
      .find((button) => button.text() === '保存');
    await save?.trigger('click');
    await flushPromises();
    expect(mocks.put).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/Role/update',
      expect.objectContaining({
        orgScopeList: [],
        deniedOrgScopeList: [
          'org-allowed|SelfAndAllChild',
          'org-denied|SelfAndAllChild',
        ],
      }),
      expect.anything(),
    );
    wrapper.unmount();
  });

  it('动态组织切换匹配模式时保留允许档并写入原有规则字段', async () => {
    const wrapper = await openDialog('role');
    const mode = wrapper.find('[aria-label="已授权组织子组织匹配模式"]');
    expect((mode.element as HTMLSelectElement).value).toBe('SelfAndAllChild');
    await mode.setValue('DirectChild');
    expect(
      choice(wrapper, '已授权组织', '允许')?.attributes('aria-pressed'),
    ).toBe('true');
    const save = wrapper
      .findAll('button')
      .find((button) => button.text() === '保存');
    await save?.trigger('click');
    await flushPromises();
    expect(mocks.put).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/Role/update',
      expect.objectContaining({
        orgScopeList: ['org-allowed|DirectChild'],
      }),
      expect.anything(),
    );
    wrapper.unmount();
  });

  it('动态组织默认档清空并禁用匹配模式，允许档自动选择起始模式', async () => {
    const wrapper = await openDialog('role', {
      orgScopeList: [],
      deniedOrgScopeList: [],
    });
    const mode = wrapper.find('[aria-label="已授权组织子组织匹配模式"]');
    expect((mode.element as HTMLSelectElement).value).toBe('');
    expect(mode.attributes('disabled')).toBeDefined();
    expect(
      choice(wrapper, '已授权组织', '未设置')?.attributes('aria-pressed'),
    ).toBe('true');
    await choice(wrapper, '已授权组织', '允许')?.trigger('click');
    expect((mode.element as HTMLSelectElement).value).toBe('SelfAndAllChild');
    expect(mode.attributes('disabled')).toBeUndefined();
    await choice(wrapper, '已授权组织', '未设置')?.trigger('click');
    expect((mode.element as HTMLSelectElement).value).toBe('');
    expect(mode.attributes('disabled')).toBeDefined();
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === '保存')
        ?.attributes('disabled'),
    ).toBeDefined();
    expect(mocks.put).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('动态组织行的访问开关位于匹配模式下拉框左侧', async () => {
    const wrapper = await openDialog('role');
    const tree = wrapper.find('[data-testid="shared-org-tree"]');
    const controls = tree.findAll('[role="radiogroup"], select');
    expect(controls[0]?.attributes('role')).toBe('radiogroup');
    expect(controls[1]?.element.tagName).toBe('SELECT');
    wrapper.unmount();
  });

  it('动态组织切换匹配模式时保留拒绝档', async () => {
    const wrapper = await openDialog('role', {
      orgScopeList: [],
      deniedOrgScopeList: ['org-allowed|SelfAndAllChild'],
    });
    await wrapper
      .find('[aria-label="已授权组织子组织匹配模式"]')
      .setValue('Self');
    expect(
      choice(wrapper, '已授权组织', '禁止')?.attributes('aria-pressed'),
    ).toBe('true');
    const save = wrapper
      .findAll('button')
      .find((button) => button.text() === '保存');
    await save?.trigger('click');
    await flushPromises();
    expect(mocks.put).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/Role/update',
      expect.objectContaining({
        deniedOrgScopeList: ['org-allowed|Self'],
      }),
      expect.anything(),
    );
    wrapper.unmount();
  });

  it('全部组织只映射全部根组织，无组织选项独立', async () => {
    const wrapper = await openDialog('role');
    await choice(wrapper, '全部组织', '禁止')?.trigger('click');
    expect(wrapper.find('[data-testid="shared-org-tree"]').exists()).toBe(
      false,
    );
    expect(
      choice(wrapper, '无组织', '未设置')?.attributes('aria-pressed'),
    ).toBe('true');
    const save = wrapper
      .findAll('button')
      .find((button) => button.text() === '保存');
    await save?.trigger('click');
    await flushPromises();
    expect(mocks.put).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/Role/update',
      expect.objectContaining({
        orgScopeList: [],
        deniedOrgScopeList: ['_ALL_ROOT_|SelfAndAllChild'],
      }),
      expect.anything(),
    );
    wrapper.unmount();
  });

  it('高级与简易模式共用待保存规则，全部根组织回显一致', async () => {
    const wrapper = await openDialog('role', {
      orgScopeList: ['_ALL_ROOT_|SelfAndAllChild'],
      deniedOrgScopeList: [],
    });
    expect(
      choice(wrapper, '全部组织', '允许')?.attributes('aria-pressed'),
    ).toBe('true');
    expect(
      choice(wrapper, '无组织', '未设置')?.attributes('aria-pressed'),
    ).toBe('true');

    await wrapper
      .find('[data-testid="data-permission-mode-switch"]')
      .trigger('click');
    const advanced = wrapper.findAll(
      '[data-testid="data-permission-advanced"]',
    )[2];
    expect(advanced?.text()).toContain('允许列表');
    expect(advanced?.text()).toContain('全部根组织 自身及全部下级');
    expect(
      wrapper.find('[data-testid="data-permission-mode-switch"]').text(),
    ).toBe('返回简单模式');
    await wrapper
      .find('[data-testid="data-permission-mode-switch"]')
      .trigger('click');
    expect(
      choice(wrapper, '全部组织', '允许')?.attributes('aria-pressed'),
    ).toBe('true');
    wrapper.unmount();
  });

  it('非超级管理员也能切换高级模式', async () => {
    mocks.superAdmin = false;
    mocks.platformUser = true;
    const wrapper = await openDialog('role');
    const switchMode = wrapper.find(
      '[data-testid="data-permission-mode-switch"]',
    );
    expect(switchMode.exists()).toBe(true);
    await switchMode.trigger('click');
    expect(
      wrapper.find('[data-testid="data-permission-advanced"]').exists(),
    ).toBe(true);
    wrapper.unmount();
  });

  it('标签允许与拒绝角标实时计数，零数量不显示', async () => {
    const wrapper = await openDialog('role');
    expect(wrapper.find('[aria-label="领域允许规则数"]').text()).toBe('1');
    expect(wrapper.find('[aria-label="领域禁止规则数"]').text()).toBe('1');
    expect(wrapper.find('[aria-label="租户允许规则数"]').text()).toBe('1');
    expect(wrapper.find('[aria-label="组织禁止规则数"]').text()).toBe('1');
    await choice(wrapper, 'domain-allowed', '未设置')?.trigger('click');
    expect(wrapper.find('[aria-label="领域允许规则数"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="领域禁止规则数"]').text()).toBe('1');
    await wrapper
      .find('[data-testid="data-permission-mode-switch"]')
      .trigger('click');
    expect(wrapper.find('[aria-label="领域允许规则数"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('高级模式添加领域后，简单模式立即回显同一待保存规则', async () => {
    mocks.domainOptions.mockResolvedValue([
      { label: '新领域', value: 'domain-new' },
    ]);
    const wrapper = await openDialog('role');
    await wrapper
      .find('[data-testid="data-permission-mode-switch"]')
      .trigger('click');
    const domainAdvanced = wrapper.findAll(
      '[data-testid="data-permission-advanced"]',
    )[0];
    await domainAdvanced
      ?.findAll('button')
      .find((button) => button.text() === '添加')
      ?.trigger('click');
    await flushPromises();
    const candidate = wrapper.find(
      '[data-testid="advanced-candidate-options"]',
    );
    expect(candidate.text()).toContain('新领域');
    await candidate
      .findAll('button')
      .find((button) =>
        button.element.parentElement?.textContent?.includes('新领域'),
      )
      ?.trigger('click');
    await wrapper
      .find('[data-testid="data-permission-mode-switch"]')
      .trigger('click');
    expect(choice(wrapper, '新领域', '允许')?.attributes('aria-pressed')).toBe(
      'true',
    );
    wrapper.unmount();
  });

  it('高级模式可查看存量特殊组织规则', async () => {
    const wrapper = await openDialog('role', {
      orgScopeList: ['custom|Groovy#true'],
    });
    await wrapper
      .find('[data-testid="data-permission-mode-switch"]')
      .trigger('click');
    const orgAdvanced = wrapper.findAll(
      '[data-testid="data-permission-advanced"]',
    )[2];
    expect(orgAdvanced?.text()).toContain('custom Groovy 表达式：true');
    await orgAdvanced
      ?.findAll('button')
      .find((button) => button.text() === '编辑')
      ?.trigger('click');
    expect(wrapper.text()).toContain('匹配表达式');
    wrapper.unmount();
  });

  it('高级列表的固定组织规则显示与匹配模式对应的说明', async () => {
    const wrapper = await openDialog('role', {
      orgScopeList: ['_DEFAULT_|Self'],
    });
    await wrapper
      .find('[data-testid="data-permission-mode-switch"]')
      .trigger('click');
    const orgAdvanced = wrapper.findAll(
      '[data-testid="data-permission-advanced"]',
    )[2];
    expect(orgAdvanced?.text()).toContain('默认组织 仅自身');
    expect(orgAdvanced?.text()).toContain('仅匹配默认组织自身的数据');
    wrapper.unmount();
  });

  it('隐藏存量特殊规则后，修改普通组织仍保留其规则值', async () => {
    const wrapper = await openDialog('role', {
      orgScopeList: [
        '_DEFAULT_|SelfAndAllChild',
        'custom|Groovy#true',
        'org-allowed|SelfAndAllChild',
      ],
    });
    const org = wrapper.find('section:nth-of-type(3)');
    expect(org.find('table').text()).toContain('默认组织（含全部下级）');
    expect(org.find('table').text()).toContain('匹配默认组织');
    expect(org.find('[data-testid="org-special-rules"]').exists()).toBe(false);
    expect(org.text()).not.toContain('编辑组织匹配规则');
    await choice(wrapper, '已授权组织', '禁止')?.trigger('click');
    const save = wrapper
      .findAll('button')
      .find((button) => button.text() === '保存');
    await save?.trigger('click');
    await flushPromises();
    expect(mocks.put).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/Role/update',
      expect.objectContaining({
        orgScopeList: ['_DEFAULT_|SelfAndAllChild', 'custom|Groovy#true'],
      }),
      expect.anything(),
    );
    wrapper.unmount();
  });

  it('用户关闭自定义时两侧范围继承角色', async () => {
    const wrapper = await openDialog('user');
    await wrapper.find('[aria-label="自定义领域范围"]').trigger('click');
    const save = wrapper
      .findAll('button')
      .find((button) => button.text() === '保存');
    await save?.trigger('click');
    await flushPromises();
    expect(mocks.put).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/User/update',
      expect.objectContaining({
        domainScopeList: null,
        deniedDomainScopeList: null,
      }),
      expect.anything(),
    );
    wrapper.unmount();
  });

  it('默认档仅移除该项，保留用户另一侧的 null 继承', async () => {
    mocks.get.mockResolvedValue({
      id: 'subject-1',
      optimisticLock: 7,
      domainScopeList: ['domain-allowed'],
      deniedDomainScopeList: null,
    });
    const wrapper = mount(DataPermissionDialog, {
      props: {
        loadDomainOptions: mocks.domainOptions,
        open: false,
        record: { id: 'subject-1' },
        subjectType: 'user',
      },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();

    await choice(wrapper, 'domain-allowed', '未设置')?.trigger('click');
    const save = wrapper
      .findAll('button')
      .find((button) => button.text() === '保存');
    await save?.trigger('click');
    await flushPromises();

    const payload = mocks.put.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.domainScopeList).toEqual([]);
    expect(payload.forceUpdateFields).toEqual(['domainScopeList']);
    expect(payload).not.toHaveProperty('deniedDomainScopeList');
    wrapper.unmount();
  });

  it('全量档切回默认时恢复单侧继承草稿', async () => {
    mocks.get.mockResolvedValue({
      id: 'subject-1',
      optimisticLock: 7,
      domainScopeList: null,
      deniedDomainScopeList: ['domain-denied'],
    });
    const wrapper = mount(DataPermissionDialog, {
      props: {
        loadDomainOptions: mocks.domainOptions,
        open: false,
        record: { id: 'subject-1' },
        subjectType: 'user',
      },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();

    await choice(wrapper, '全部领域', '允许')?.trigger('click');
    await choice(wrapper, '全部领域', '未设置')?.trigger('click');
    const save = wrapper
      .findAll('button')
      .find((button) => button.text() === '保存');
    expect(save?.attributes('disabled')).toBeDefined();
    expect(mocks.put).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('租户候选可继续加载且已保存项始终可见', async () => {
    const first = Array.from({ length: 50 }, (_, index) => ({
      label: `候选租户 ${index + 1}`,
      value: `tenant-${index + 1}`,
    }));
    tenantDataScopeOptionsLoader
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce([{ label: '候选租户 51', value: 'tenant-51' }]);
    const wrapper = await openDialog('role');
    expect(wrapper.text()).toContain('tenant-allowed');
    const more = wrapper
      .findAll('button')
      .find((button) => button.text() === '加载更多租户');
    await more?.trigger('click');
    await flushPromises();
    expect(tenantDataScopeOptionsLoader).toHaveBeenCalledWith('', 2);
    expect(wrapper.text()).toContain('候选租户 51');
    wrapper.unmount();
  });

  it('默认租户预设与同名真实租户按 ID 区分', async () => {
    tenantDataScopeOptionsLoader.mockResolvedValueOnce([
      { label: '默认租户', value: 'tenant-real' },
    ]);
    const wrapper = await openDialog('role');
    const tenant = wrapper.find('section:nth-of-type(2)');
    expect(tenant.find('table').text()).toContain('默认租户');
    expect(tenant.text()).toContain('默认租户（ID tenant-real）');
    expect(tenant.text()).toContain('平台用户匹配无租户数据');
    wrapper.unmount();
  });
});
