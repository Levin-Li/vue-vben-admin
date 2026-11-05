import { flushPromises, mount } from '@vue/test-utils';

import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import { Button, DatePicker, Select } from 'ant-design-vue';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InvitationLinkPage from '../index.vue';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  request: vi.fn(),
  error: vi.fn(),
  hasPermission: vi.fn(),
  user: { userInfo: { id: 'issuer', tenantId: 'tenant', orgId: 'org' } },
  route: {
    path: '/clob/V1/InvitationLink',
    fullPath: '/clob/V1/InvitationLink',
    matched: [],
    meta: {},
    query: {},
  },
}));
vi.mock('@levin/admin-framework/framework-commons/app/api/request', () => ({
  requestClient: { get: mocks.get, post: mocks.post, request: mocks.request },
  baseRequestClient: { get: mocks.get },
}));
vi.mock('@levin/admin-framework/framework-commons/runtime', () => ({
  requestClient: { get: mocks.get, post: mocks.post, request: mocks.request },
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: mocks.hasPermission }),
}));
vi.mock('@vben/runtime/stores', () => ({
  getTabKey: (route: { path: string }) => route.path,
  useUserStore: () => mocks.user,
  useAccessStore: () => ({ accessCodes: [] }),
  useTabbarStore: () => ({ setPageKeepAlive: vi.fn() }),
}));
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRoute: () => mocks.route,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('ant-design-vue', async (original) => ({
  ...(await original<typeof import('ant-design-vue')>()),
  message: {
    error: mocks.error,
    warning: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));
let wrapper: ReturnType<typeof mount> | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasPermission.mockReturnValue(true);
  mocks.user.userInfo = { id: 'issuer', tenantId: 'tenant', orgId: 'org' };
  // 公共 RequestService 通过 request() 发送请求，测试替身按方法转交现有断言记录。
  mocks.request.mockImplementation(
    (path: string, options: { method: string }) =>
      options.method === 'GET'
        ? mocks.get(path, options)
        : mocks.post(path, options),
  );
  mocks.get.mockResolvedValue([]);
  mocks.post.mockImplementation(async (path: string) => {
    if (path.endsWith('/targetDictionaryOptions')) return [];
    if (path.endsWith('/list')) return { items: [], total: 0 };
    if (path.endsWith('/targetOrganizations'))
      return [
        { id: 'org', name: '测试组织' },
        { id: 'org-b', name: '另一个可访问组织' },
      ];
    return {
      id: 'new-invitation',
      url: 'https://example.test/invite?token=test',
    };
  });
});
afterEach(() => {
  wrapper?.unmount();
});

describe('邀请真实公共表单提交', () => {
  it.each([
    { target: '内部用户', denied: '邀请组织管理员', adminVisible: false },
    { target: '内部用户', denied: '邀请子组织管理员', adminVisible: true },
    { target: '客户', denied: '邀请组织管理员', adminVisible: true },
    { target: '客户', denied: '邀请子组织管理员', adminVisible: false },
  ])(
    '内部和外部管理员选项分别校验各自权限：$target / $denied',
    async ({ target, denied, adminVisible }) => {
      mocks.hasPermission.mockImplementation(
        (permissions: string[]) =>
          !permissions.some((permission) => permission.includes(denied)),
      );
      wrapper = mount(InvitationLinkPage, {
        attachTo: document.body,
        global: {
          plugins: [createPinia()],
          stubs: { Page: { template: '<div><slot /></div>' }, ATable: true },
        },
      });
      await flushPromises();
      const action = wrapper
        .findAllComponents(Button)
        .find((button) => button.text() === `创建${target}邀请`);
      if (!action) throw new Error(`缺少${target}邀请入口`);
      await action.trigger('click');
      await flushPromises();
      const modal = wrapper
        .findAllComponents({ name: 'AModal' })
        .find((item) => item.props('open') === true);
      if (!modal) throw new Error('缺少邀请表单');
      const identity = modal
        .findAllComponents(Select)
        .find((select) =>
          select
            .props('options')
            ?.some((option: any) => option.value === 'Employee'),
        );
      if (!identity) throw new Error('缺少账号身份选择');
      expect(
        (identity.props('options') || []).some(
          (option: any) => option.value === 'Administrator',
        ),
      ).toBe(adminVisible);
    },
    20_000,
  );

  it.each(['JoinInviterOrg', 'CreateChildOrg'] as const)(
    '有权签发人可创建内部管理员邀请，组织安排为 %s',
    async (mode) => {
      wrapper = mount(InvitationLinkPage, {
        attachTo: document.body,
        global: {
          plugins: [createPinia()],
          stubs: { Page: { template: '<div><slot /></div>' }, ATable: true },
        },
      });
      await flushPromises();
      const action = wrapper
        .findAllComponents(Button)
        .find((button) => button.text() === '创建内部用户邀请');
      if (!action) throw new Error('缺少内部邀请入口');
      await action.trigger('click');
      await flushPromises();
      const modal = wrapper
        .findAllComponents({ name: 'AModal' })
        .find((item) => item.props('open') === true);
      if (!modal) throw new Error('缺少内部邀请表单');
      const findSelect = (value: string) =>
        modal
          .findAllComponents(Select)
          .find((select) =>
            select.props('options')?.some((item: any) => item.value === value),
          );
      const organization = modal.findComponent({ name: 'UserOrgSelector' });
      expect(organization.props('selectableTypes')).toEqual(['org']);
      expect(organization.props('maxSelectCount')).toBe(1);
      expect(await (organization.props('orgLoadApi') as any)()).toContainEqual({
        id: 'org',
        name: '测试组织',
      });
      organization.vm.$emit('update:modelValue', 'org');
      for (const value of ['Administrator', mode]) {
        const select = findSelect(value);
        if (!select) throw new Error(`缺少选项 ${value}`);
        select.vm.$emit('update:value', value);
        await flushPromises();
      }
      if (mode === 'CreateChildOrg') {
        const childType = findSelect('Department');
        if (!childType) throw new Error('缺少子组织类型');
        childType.vm.$emit('update:value', 'Department');
        await flushPromises();
      }
      const save = document.body.querySelector<HTMLButtonElement>(
        '.ant-modal-footer button.ant-btn-primary',
      );
      if (!save) throw new Error('缺少确认按钮');
      save.click();
      await vi.waitFor(() =>
        expect(
          mocks.post.mock.calls.some(([path]) =>
            String(path).endsWith('/createInternal'),
          ),
        ).toBe(true),
      );
      const request = mocks.post.mock.calls.find(([path]) =>
        String(path).endsWith('/createInternal'),
      );
      expect(request?.[1].data).toMatchObject({
        targetOrgId: 'org',
        userType: 'Administrator',
        organizationMode: mode,
      });
      expect(request?.[1].data.childOrgType).toBe(
        mode === 'CreateChildOrg' ? 'Department' : undefined,
      );
    },
    20_000,
  );

  it('渠道客户随目标组织加载授权渠道，切换组织清除旧渠道', async () => {
    mocks.user.userInfo = {
      id: 'platform',
      tenantId: '',
      orgId: '',
      platformUser: true,
    } as any;
    mocks.post.mockImplementation(async (path: string, options: any) => {
      if (path.endsWith('/targetTenants'))
        return [{ id: 'tenant-a', name: '租户甲' }];
      if (path.endsWith('/targetOrganizations'))
        return [
          { id: 'org-a', name: '甲组织' },
          { id: 'org-b', name: '乙组织' },
        ];
      if (path.endsWith('/targetChannels'))
        return [
          { id: `channel-${options.data.targetOrgId}`, name: '授权渠道' },
        ];
      if (path.endsWith('/targetDictionaryOptions')) return [];
      if (path.endsWith('/list')) return { items: [], total: 0 };
      return { id: 'created', url: 'https://example.test/invite?token=test' };
    });
    wrapper = mount(InvitationLinkPage, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()],
        stubs: { Page: { template: '<div><slot /></div>' }, ATable: true },
      },
    });
    await flushPromises();
    const action = wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '创建客户邀请');
    if (!action) throw new Error('缺少客户邀请入口');
    await action.trigger('click');
    await flushPromises();
    const modal = wrapper
      .findAllComponents({ name: 'AModal' })
      .find((item) => item.props('open') === true);
    if (!modal) throw new Error('缺少邀请表单');
    const findSelect = (value: string) =>
      modal
        .findAllComponents(Select)
        .find((select) =>
          select.props('options')?.some((item: any) => item.value === value),
        );
    for (const value of ['tenant-a', 'Employee', 'ChannelCustomer']) {
      const select = findSelect(value);
      if (!select) throw new Error(`缺少选择项 ${value}`);
      select.vm.$emit('update:value', value);
      await flushPromises();
    }
    const organization = modal.findComponent({ name: 'UserOrgSelector' });
    organization.vm.$emit('update:modelValue', 'org-a');
    await flushPromises();
    const firstChannel = findSelect('channel-org-a');
    if (!firstChannel) throw new Error('未加载甲组织授权渠道');
    firstChannel.vm.$emit('update:value', 'channel-org-a');
    await flushPromises();
    organization.vm.$emit('update:modelValue', 'org-b');
    await flushPromises();
    const secondChannel = findSelect('channel-org-b');
    if (!secondChannel) throw new Error('未加载乙组织授权渠道');
    expect(secondChannel.props('value')).toBeUndefined();
    secondChannel.vm.$emit('update:value', 'channel-org-b');
    await flushPromises();
    const save = document.body.querySelector<HTMLButtonElement>(
      '.ant-modal-footer button.ant-btn-primary',
    );
    if (!save) throw new Error('缺少确认按钮');
    save.click();
    await vi.waitFor(() =>
      expect(
        mocks.post.mock.calls.some(([path]) =>
          String(path).endsWith('/createCustomer'),
        ),
      ).toBe(true),
    );
    const request = mocks.post.mock.calls.find(([path]) =>
      String(path).endsWith('/createCustomer'),
    );
    expect(request?.[1].data).toMatchObject({
      tenantId: 'tenant-a',
      targetOrgId: 'org-b',
      channelPartnerId: 'channel-org-b',
    });
  }, 20_000);

  it.each([{ platformAdmin: true }, { superAdmin: true }])(
    '平台管理员和超级管理员均能在表单选择租户：%o',
    async (identity) => {
      mocks.user.userInfo = {
        id: 'platform',
        tenantId: '',
        orgId: '',
        ...identity,
      } as any;
      mocks.post.mockImplementation(async (path: string) => {
        if (path.endsWith('/targetTenants'))
          return [{ id: 'tenant-a', name: '租户甲' }];
        if (path.endsWith('/list')) return { items: [], total: 0 };
        return [];
      });
      wrapper = mount(InvitationLinkPage, {
        attachTo: document.body,
        global: {
          plugins: [createPinia()],
          stubs: { Page: { template: '<div><slot /></div>' }, ATable: true },
        },
      });
      await flushPromises();
      const action = wrapper
        .findAllComponents(Button)
        .find((button) => button.text() === '创建会员用户邀请');
      if (!action) throw new Error('缺少会员邀请入口');
      await action.trigger('click');
      await flushPromises();
      const modal = wrapper
        .findAllComponents({ name: 'AModal' })
        .find((item) => item.props('open') === true);
      if (!modal) throw new Error('平台用户未打开邀请表单');
      expect(
        modal
          .findAllComponents(Select)
          .some((select) =>
            select
              .props('options')
              ?.some((option: any) => option.value === 'tenant-a'),
          ),
      ).toBe(true);
    },
    20_000,
  );

  it('服务端明确非平台身份时不启用平台租户选择', async () => {
    mocks.user.userInfo = {
      id: 'issuer',
      tenantId: 'tenant',
      orgId: 'org',
      platformUser: false,
      platformAdmin: true,
    } as any;
    wrapper = mount(InvitationLinkPage, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()],
        stubs: { Page: { template: '<div><slot /></div>' }, ATable: true },
      },
    });
    await flushPromises();
    const action = wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '创建会员用户邀请');
    if (!action) throw new Error('缺少会员邀请入口');
    await action.trigger('click');
    await flushPromises();
    expect(
      mocks.post.mock.calls.some(([path]) =>
        String(path).endsWith('/targetOrganizations'),
      ),
    ).toBe(true);
    expect(
      mocks.post.mock.calls.some(([path]) =>
        String(path).endsWith('/targetTenants'),
      ),
    ).toBe(false);
  });

  it.each([true, false])(
    '内部邀请按管理员权限 %s 控制账号身份选项',
    async (hasAdminPermission) => {
      mocks.hasPermission.mockImplementation(
        (permissions: string[]) =>
          hasAdminPermission ||
          !permissions.some((permission) =>
            permission.includes('邀请组织管理员'),
          ),
      );
      wrapper = mount(InvitationLinkPage, {
        attachTo: document.body,
        global: {
          plugins: [createPinia()],
          stubs: { Page: { template: '<div><slot /></div>' }, ATable: true },
        },
      });
      await flushPromises();
      const config = wrapper.findComponent(CrudPage).props('config') as any;
      expect(
        config.fields.find((field: any) => field.key === 'userType').options,
      ).toContainEqual({
        label: '管理员',
        value: 'Administrator',
      });
      const action = wrapper
        .findAllComponents(Button)
        .find((button) => button.text() === '创建内部用户邀请');
      if (!action) throw new Error('缺少内部邀请入口');
      await action.trigger('click');
      await flushPromises();
      const modal = wrapper
        .findAllComponents({ name: 'AModal' })
        .find((item) => item.props('open') === true);
      if (!modal) throw new Error('缺少邀请表单');
      const identity = modal
        .findAllComponents(Select)
        .find((select) =>
          select
            .props('options')
            ?.some((option: any) => option.value === 'Employee'),
        );
      if (!identity) throw new Error('缺少账号身份选择');
      expect(identity.props('options')).toEqual([
        { label: '普通员工', value: 'Employee' },
        ...(hasAdminPermission
          ? [{ label: '管理员', value: 'Administrator' }]
          : []),
      ]);
      expect(identity.props('value')).toBe('Employee');
      expect(identity.props('disabled')).toBeFalsy();
    },
    20_000,
  );

  it('外部邀请使用所选租户的组织类别和用户类型并在切换租户时清除旧值', async () => {
    mocks.user.userInfo = {
      id: 'platform',
      tenantId: '',
      orgId: '',
      platformUser: true,
    } as any;
    mocks.post.mockImplementation(async (path: string, options: any) => {
      if (path.endsWith('/targetTenants'))
        return [
          { id: 'tenant-a', name: '租户甲' },
          { id: 'tenant-b', name: '租户乙' },
        ];
      if (path.endsWith('/targetOrganizations'))
        return [{ id: `org-${options.data.tenantId}`, name: '可邀请组织' }];
      if (path.endsWith('/targetDictionaryOptions'))
        return [
          {
            value: `${options.data.field}-${options.data.tenantId}`,
            label: '测试类别',
          },
        ];
      if (path.endsWith('/list')) return { items: [], total: 0 };
      return { id: 'created', url: 'https://example.test/invite?token=test' };
    });
    wrapper = mount(InvitationLinkPage, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()],
        stubs: { Page: { template: '<div><slot /></div>' }, ATable: true },
      },
    });
    await flushPromises();
    const action = wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '创建客户邀请');
    if (!action) throw new Error('缺少客户邀请入口');
    await action.trigger('click');
    await flushPromises();
    const modal = wrapper
      .findAllComponents({ name: 'AModal' })
      .find((item) => item.props('open') === true);
    if (!modal) throw new Error('缺少邀请表单');
    const findSelect = (value: string) =>
      modal
        .findAllComponents(Select)
        .find((select) =>
          select.props('options')?.some((item: any) => item.value === value),
        );
    const tenant = findSelect('tenant-a');
    if (!tenant) throw new Error('缺少租户选择');
    tenant.vm.$emit('update:value', 'tenant-a');
    await flushPromises();
    modal
      .findComponent({ name: 'UserOrgSelector' })
      .vm.$emit('update:modelValue', 'org-tenant-a');
    for (const value of [
      'organizationCategory-tenant-a',
      'accountType-tenant-a',
    ]) {
      const select = findSelect(value);
      if (!select) throw new Error(`缺少租户甲选项 ${value}`);
      select.vm.$emit('update:value', value);
    }
    await flushPromises();
    tenant.vm.$emit('update:value', 'tenant-b');
    await flushPromises();
    for (const oldValue of [
      'org-tenant-a',
      'organizationCategory-tenant-a',
      'accountType-tenant-a',
    ]) {
      expect(
        modal
          .findAllComponents(Select)
          .some((select) => select.props('value') === oldValue),
      ).toBe(false);
    }
    const newOrganization = modal.findComponent({ name: 'UserOrgSelector' });
    expect(newOrganization.props('modelValue')).toBeUndefined();
    expect(await (newOrganization.props('orgLoadApi') as any)()).toEqual([
      { id: 'org-tenant-b', name: '可邀请组织' },
    ]);
    newOrganization.vm.$emit('update:modelValue', 'org-tenant-b');
    for (const value of [
      'organizationCategory-tenant-b',
      'accountType-tenant-b',
      'Employee',
      'DirectCustomer',
    ]) {
      const select = findSelect(value);
      if (!select) throw new Error(`缺少目标选项 ${value}`);
      select.vm.$emit('update:value', value);
    }
    await flushPromises();
    const save = document.body.querySelector<HTMLButtonElement>(
      '.ant-modal-footer button.ant-btn-primary',
    );
    if (!save) throw new Error('缺少确认按钮');
    save.click();
    await vi.waitFor(() =>
      expect(
        mocks.post.mock.calls.some(([path]) =>
          String(path).endsWith('/createCustomer'),
        ),
      ).toBe(true),
    );
    const request = mocks.post.mock.calls.find(([path]) =>
      String(path).endsWith('/createCustomer'),
    );
    expect(request?.[1].data).toMatchObject({
      tenantId: 'tenant-b',
      targetOrgId: 'org-tenant-b',
      organizationCategory: 'organizationCategory-tenant-b',
      accountType: 'accountType-tenant-b',
    });
  }, 20_000);

  it('平台用户先选择租户，切换时清空组织并忽略旧租户异步响应', async () => {
    mocks.user.userInfo = {
      id: 'platform',
      tenantId: '',
      orgId: '',
      platformUser: true,
    } as any;
    let resolveOld!: (value: Array<{ id: string; name: string }>) => void;
    const oldRequest = new Promise<Array<{ id: string; name: string }>>(
      (resolve) => {
        resolveOld = resolve;
      },
    );
    mocks.post.mockImplementation(async (path: string, options: any) => {
      if (path.endsWith('/targetTenants'))
        return [
          { id: 'tenant-a', name: '租户甲' },
          { id: 'tenant-b', name: '租户乙' },
        ];
      if (path.endsWith('/targetOrganizations')) {
        return options.data?.tenantId === 'tenant-a'
          ? oldRequest
          : [{ id: 'org-b', name: '乙组织' }];
      }
      if (path.endsWith('/list')) return { items: [], total: 0 };
      return { id: 'created', url: 'https://example.test/invite?token=test' };
    });
    wrapper = mount(InvitationLinkPage, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()],
        stubs: { Page: { template: '<div><slot /></div>' }, ATable: true },
      },
    });
    await flushPromises();
    const action = wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '创建会员用户邀请');
    if (!action) throw new Error('缺少会员邀请入口');
    await action.trigger('click');
    await flushPromises();
    const modal = wrapper
      .findAllComponents({ name: 'AModal' })
      .find((item) => item.props('open') === true);
    if (!modal) throw new Error('平台用户未打开邀请表单');
    const tenantSelect = modal
      .findAllComponents(Select)
      .find((select) =>
        select.props('options')?.some((item: any) => item.value === 'tenant-a'),
      );
    if (!tenantSelect) throw new Error('缺少租户选择');
    tenantSelect.vm.$emit('update:value', 'tenant-a');
    await flushPromises();
    const nextTenantSelect = wrapper
      .findAllComponents(Select)
      .find((select) =>
        select.props('options')?.some((item: any) => item.value === 'tenant-b'),
      );
    if (!nextTenantSelect) throw new Error('切换后缺少租户选择');
    nextTenantSelect.vm.$emit('update:value', 'tenant-b');
    await flushPromises();
    resolveOld([{ id: 'org-a', name: '甲组织' }]);
    await flushPromises();
    const organization = modal.findComponent({ name: 'UserOrgSelector' });
    expect(await (organization.props('orgLoadApi') as any)()).toEqual([
      { id: 'org-b', name: '乙组织' },
    ]);
    organization.vm.$emit('update:modelValue', 'org-b');
    await flushPromises();
    const save = document.body.querySelector<HTMLButtonElement>(
      '.ant-modal-footer button.ant-btn-primary',
    );
    if (!save) throw new Error('缺少确认按钮');
    save.click();
    await vi.waitFor(() =>
      expect(
        mocks.post.mock.calls.some(([path]) =>
          String(path).endsWith('/createMember'),
        ),
      ).toBe(true),
    );
    const request = mocks.post.mock.calls.find(([path]) =>
      String(path).endsWith('/createMember'),
    );
    expect(request?.[1].data).toMatchObject({
      tenantId: 'tenant-b',
      targetOrgId: 'org-b',
    });
  }, 20_000);

  it('真实公共控件依次创建限定人数会员和直接客户，保留隐藏参数并排除条件字段', async () => {
    wrapper = mount(InvitationLinkPage, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()],
        stubs: { Page: { template: '<div><slot /></div>' }, ATable: true },
      },
    });
    await flushPromises();
    const action = wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '创建会员用户邀请');
    if (!action) throw new Error('缺少实际控件：action');
    await action.trigger('click');
    await flushPromises();
    const crud = wrapper.findComponent(CrudPage);
    expect(crud.exists()).toBe(true);
    expect((crud.vm as any).isFormOpen()).toBe(true);
    const modal = wrapper
      .findAllComponents({ name: 'AModal' })
      .find((item) => item.props('open') === true);
    if (!modal) throw new Error('缺少实际控件：modal');
    expect((crud.props('config') as any).createFormTitle).toBe(
      '新增会员用户邀请链接',
    );
    const selects = modal.findAllComponents(Select);
    const targetOrganization = modal.findComponent({ name: 'UserOrgSelector' });
    expect(targetOrganization.exists()).toBe(true);
    targetOrganization.vm.$emit('update:modelValue', 'org-b');
    const usage = selects.find((select) =>
      select
        .props('options')
        ?.some((option: any) => option.value === 'Limited'),
    );
    if (!usage) throw new Error('缺少实际控件：usage');
    usage.vm.$emit('update:value', 'Limited');
    await flushPromises();
    const input = document.body.querySelector(
      'input[role="spinbutton"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = '10';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(modal.findAllComponents(DatePicker)).toHaveLength(1);
    expect(modal.findComponent(DatePicker).props('showTime')).toBe(false);
    const save = document.body.querySelector<HTMLButtonElement>(
      '.ant-modal-footer button.ant-btn-primary',
    );
    if (!save) throw new Error('缺少新增表单确认按钮');
    save.click();
    await flushPromises();
    await vi.waitFor(() =>
      expect(
        mocks.post.mock.calls.some(([path]) =>
          String(path).endsWith('/createMember'),
        ),
      ).toBe(true),
    );
    const submitted = mocks.post.mock.calls.find(([path]) =>
      String(path).endsWith('/createMember'),
    );
    if (!submitted) throw new Error('缺少实际创建请求');
    const [, request] = submitted;
    expect(request.data).toMatchObject({
      targetOrgId: 'org-b',
      userType: 'Employee',
      organizationMode: 'JoinInviterOrg',
      usageMode: 'Limited',
      maxRegistrations: 10,
      expiresAt: null,
    });
    expect(request.data).not.toHaveProperty('childOrgType');
    expect(request.data).not.toHaveProperty('customerType');
    expect(mocks.error).not.toHaveBeenCalled();
    const createdPopup = wrapper
      .findAllComponents({ name: 'AModal' })
      .find((item) => item.props('title') === '邀请链接已创建');
    if (!createdPopup) throw new Error('缺少创建结果弹窗');
    createdPopup.vm.$emit('cancel');
    await flushPromises();
    expect((crud.vm as any).isFormOpen()).toBe(false);
    const customerAction = wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '创建客户邀请');
    if (!customerAction) throw new Error('缺少创建客户邀请标准动作');
    await customerAction.trigger('click');
    await flushPromises();
    const customerModal = wrapper
      .findAllComponents({ name: 'AModal' })
      .find((item) => item.props('open') === true);
    if (!customerModal) throw new Error('缺少真实新增表单');
    expect((crud.props('config') as any).createFormTitle).toBe(
      '新增客户邀请链接',
    );
    expect(
      customerModal
        .findAllComponents(Select)
        .some((select) =>
          select
            .props('options')
            ?.some(
              (item: any) =>
                item.value === 'Administrator' && item.label === '管理员',
            ),
        ),
    ).toBe(true);
    for (const value of ['Employee', 'DirectCustomer']) {
      const select = customerModal
        .findAllComponents(Select)
        .find((control) =>
          control
            .props('options')
            ?.some((option: any) => option.value === value),
        );
      if (!select) throw new Error(`缺少实际选择控件：${value}`);
      select.vm.$emit('update:value', value);
    }
    const customerOrganization = customerModal.findComponent({
      name: 'UserOrgSelector',
    });
    expect(customerOrganization.exists()).toBe(true);
    customerOrganization.vm.$emit('update:modelValue', 'org');
    const customerDate = customerModal
      .findAllComponents(DatePicker)
      .find((picker) => !picker.props('showTime'));
    if (!customerDate) throw new Error('缺少到期日期控件');
    customerDate.vm.$emit(
      'update:value',
      new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
    );
    await flushPromises();
    const customerSave = document.body.querySelector<HTMLButtonElement>(
      '.ant-modal-footer button.ant-btn-primary',
    );
    if (!customerSave) throw new Error('缺少客户表单确认按钮');
    customerSave.click();
    await flushPromises();
    await vi.waitFor(() =>
      expect(
        mocks.post.mock.calls.some(([path]) =>
          String(path).endsWith('/createCustomer'),
        ),
      ).toBe(true),
    );
    const customerSubmitted = mocks.post.mock.calls.find(([path]) =>
      String(path).endsWith('/createCustomer'),
    );
    if (!customerSubmitted) throw new Error('缺少客户邀请真实请求');
    expect(customerSubmitted[1].data).toMatchObject({
      targetOrgId: 'org',
      userType: 'Employee',
      organizationMode: 'CreateChildOrg',
      childOrgType: 'Customer',
      customerType: 'DirectCustomer',
      usageMode: 'Single',
      expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(customerSubmitted[1].data).not.toHaveProperty('channelPartnerId');
    expect(customerSubmitted[1].data).not.toHaveProperty('maxRegistrations');
    expect(mocks.error).not.toHaveBeenCalled();
  }, 20_000);
});
