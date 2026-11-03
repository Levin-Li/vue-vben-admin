/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, onMounted, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import InvitationLinkPage from '../index.vue';

const {
  list,
  copyLink,
  retrieve,
  createCustomer,
  createInternal,
  writeText,
  permissionAllowed,
  targetOrganizations,
  targetTenants,
  targetDictionaryOptions,
  targetChannels,
  user,
  openCreate,
} = vi.hoisted(() => ({
  list: vi.fn(),
  copyLink: vi.fn(),
  retrieve: vi.fn(),
  createCustomer: vi.fn(),
  createInternal: vi.fn(),
  writeText: vi.fn(),
  permissionAllowed: vi.fn(),
  targetOrganizations: vi.fn(),
  targetTenants: vi.fn(),
  targetDictionaryOptions: vi.fn(),
  targetChannels: vi.fn(),
  user: { userInfo: { tenantId: 'tenant', orgId: 'org' } },
  openCreate: vi.fn(),
}));

vi.mock('@vben/runtime/stores', () => ({ useUserStore: () => user }));
vi.mock(
  '@levin/admin-framework/framework-commons/api-authorize',
  async (original) => ({
    ...(await original<
      typeof import('@levin/admin-framework/framework-commons/api-authorize')
    >()),
    getCrudOpMeta: () => ({ label: '创建邀请', opRefTargetType: 'None' }),
  }),
);
vi.mock('../../../api/invitation-link-service', () => ({
  invitationLinkService: {
    list,
    copyLink,
    createInternal,
    createCustomer,
    createMember: vi.fn(),
    targetOrganizations,
    targetTenants,
    targetDictionaryOptions,
    targetChannels,
    createSupplierPartner: vi.fn(),
    createChannelPartner: vi.fn(),
    canInviteChildAdmin: vi.fn(),
    canInviteOrgAdmin: vi.fn(),
    retrieve,
    revoke: vi.fn(),
  },
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: permissionAllowed }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, method: string) => method,
  }),
);
vi.mock(
  '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue',
  () => ({
    default: defineComponent({
      name: 'CrudPageStub',
      props: { config: { type: Object, required: true } },
      setup(props, { expose, slots }) {
        const rows = ref<any[]>([]);
        const current = ref(1);
        async function load(page = current.value) {
          const result = await (props.config as any).apiService.list({
            pageIndex: page,
            pageSize: 20,
          });
          rows.value = result.items;
        }
        let formOpen = false;
        expose({
          reload: () => load(),
          openCreate: () => {
            formOpen = true;
            openCreate();
          },
          isFormOpen: () => formOpen,
        });
        onMounted(() => void load());
        return () =>
          h('main', [
            slots['toolbar-extra']?.(),
            ...(props.config as any).rowActions
              .filter((action: any) => action.visible?.({}) ?? true)
              .map((action: any) =>
                h(
                  'button',
                  {
                    'data-action': action.displayKey,
                    onClick: () => action.handler({}),
                  },
                  action.label,
                ),
              ),
            ...rows.value.map((record) =>
              h('div', { class: 'row' }, slots['row-actions']?.({ record })),
            ),
            h(
              'button',
              { onClick: () => void load((current.value = 2)) },
              '下一页',
            ),
          ]);
      },
    }),
  }),
);
vi.mock('ant-design-vue', () => ({
  Button: defineComponent({
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  }),
  Form: Object.assign(defineComponent({ template: '<div><slot /></div>' }), {
    Item: defineComponent({ template: '<div><slot /></div>' }),
  }),
  Input: defineComponent({ template: '<input />' }),
  Modal: defineComponent({
    props: { open: Boolean },
    template: '<div v-if="open"><slot /></div>',
  }),
  Select: defineComponent({
    props: { options: Array },
    emits: ['update:value'],
    template:
      '<div><button v-for="option in options" :key="option.value" :data-target="option.value" @click="$emit(\'update:value\', option.value)">{{ option.label }}</button></div>',
  }),
  message: { success: vi.fn(), error: vi.fn() },
}));

describe('邀请链接页面公共 CRUD 行为', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    targetOrganizations.mockResolvedValue([{ id: 'org', name: '测试组织' }]);
    targetTenants.mockResolvedValue([{ id: 'tenant', name: '测试租户' }]);
    targetDictionaryOptions.mockResolvedValue([]);
    targetChannels.mockResolvedValue([]);
    user.userInfo = { tenantId: 'tenant', orgId: 'org' };
    permissionAllowed.mockImplementation(
      (method: string) =>
        !['canInviteChildAdmin', 'canInviteOrgAdmin'].includes(method),
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    list.mockImplementation(({ pageIndex }: { pageIndex: number }) =>
      Promise.resolve({
        pageIndex,
        pageSize: 20,
        total: 2,
        items: [
          {
            id: pageIndex === 1 ? 'latest' : 'older',
            targetType: 'Internal',
            status: 'Active',
            successCount: 0,
          },
        ],
      }),
    );
    copyLink.mockResolvedValue({
      id: 'older',
      url: 'https://example.test/invite?token=older',
    });
    createCustomer.mockResolvedValue({
      id: 'created',
      url: 'https://example.test/invite?token=created',
    });
  });

  it('翻页后仍能复制旧链接', async () => {
    const wrapper = mount(InvitationLinkPage);
    await flushPromises();
    const nextPage = wrapper
      .findAll('button')
      .find((button) => button.text() === '下一页');
    if (!nextPage) throw new Error('第一页后缺少分页入口');
    await nextPage.trigger('click');
    await flushPromises();
    expect(list).toHaveBeenNthCalledWith(2, { pageIndex: 2, pageSize: 20 });
    const oldRow = wrapper.findAll('.row')[0];
    if (!oldRow) throw new Error('第二页旧链接没有出现');
    await oldRow.get('button').trigger('click');
    await flushPromises();
    expect(copyLink).toHaveBeenCalledWith('older');
    expect(writeText).toHaveBeenCalledWith(
      'https://example.test/invite?token=older',
    );
    wrapper.unmount();
  });

  it('内部员工详情使用普通员工称呼，外部员工保留原身份值', async () => {
    const wrapper = mount(InvitationLinkPage);
    await flushPromises();
    const config = wrapper
      .findComponent({ name: 'CrudPageStub' })
      .props('config') as any;
    retrieve.mockResolvedValueOnce({
      id: 'internal',
      targetType: 'Internal',
      userType: 'Employee',
    });
    await expect(
      config.apiService.retrieve({ id: 'internal' }),
    ).resolves.toMatchObject({ userType: '普通员工' });
    retrieve.mockResolvedValueOnce({
      id: 'external',
      targetType: 'Customer',
      userType: 'Employee',
    });
    await expect(
      config.apiService.retrieve({ id: 'external' }),
    ).resolves.toMatchObject({ userType: 'Employee' });
    wrapper.unmount();
  });

  it('租户用户详情仅显示适用的业务摘要，不泄露内部标识和未声明字段', async () => {
    const wrapper = mount(InvitationLinkPage);
    await flushPromises();
    const config = wrapper
      .findComponent({ name: 'CrudPageStub' })
      .props('config') as any;
    retrieve.mockResolvedValue({
      id: 'internal-id',
      tenantId: 'tenant',
      targetOrgId: 'org',
      targetOrgName: '组织名称',
      targetType: 'Internal',
      userType: 'Employee',
      registrationChannel: 'Phone',
      usageMode: 'Single',
      status: 'Active',
      successCount: 1,
      url: 'https://example.test/invite?secret=1',
      revokedAt: null,
      remainingRegistrations: 1,
      requiresExternalOrganization: false,
      organizationCategory: null,
      accountType: null,
      customerType: null,
      futureInternalField: '不展示',
    });
    const detail = await config.apiService.retrieve({ id: 'internal-id' });
    expect(detail).toMatchObject({
      targetOrgName: '组织名称',
      targetType: 'Internal',
      userType: '普通员工',
      registrationChannel: 'Phone',
    });
    for (const key of [
      'id',
      'tenantId',
      'targetOrgId',
      'url',
      'revokedAt',
      'remainingRegistrations',
      'requiresExternalOrganization',
      'organizationCategory',
      'accountType',
      'customerType',
      'futureInternalField',
    ]) {
      expect(detail).not.toHaveProperty(key);
    }
    wrapper.unmount();
  });

  it('标准目标动作打开公共新增并固定权限、字段策略和独立创建方法', async () => {
    const wrapper = mount(InvitationLinkPage);
    await flushPromises();
    const crud = wrapper.findComponent({ name: 'CrudPageStub' });
    expect((crud.props('config') as any).dataAttrTargets.create.path).toContain(
      '/InvitationLink/createInternal',
    );
    expect(() =>
      (crud.props('config') as any).transformSubmit({
        userType: 'Administrator',
        organizationMode: 'CreateChildOrg',
      }),
    ).toThrow('当前账号无权邀请管理员');
    permissionAllowed.mockReturnValue(true);
    for (const mode of ['JoinInviterOrg', 'CreateChildOrg']) {
      expect(
        (crud.props('config') as any).transformSubmit({
          userType: 'Administrator',
          organizationMode: mode,
          childOrgType: 'Department',
        }),
      ).toMatchObject({ userType: 'Administrator', organizationMode: mode });
    }
    permissionAllowed.mockImplementation(
      (method: string) =>
        !['canInviteChildAdmin', 'canInviteOrgAdmin'].includes(method),
    );
    await wrapper
      .get('[data-action="invitation:createCustomer"]')
      .trigger('click');
    await flushPromises();
    expect(openCreate).toHaveBeenCalledTimes(1);
    const config = crud.props('config') as any;
    expect(config.createPermission).toBe('createCustomer');
    expect(config.dataAttrTargets.create.path).toContain(
      '/InvitationLink/createCustomer',
    );
    expect(() =>
      config.transformSubmit({
        userType: 'Administrator',
        organizationMode: 'CreateChildOrg',
      }),
    ).toThrow('当前账号无权邀请管理员');
    await config.apiService.create(
      config.transformSubmit({
        userType: 'Employee',
        customerType: 'DirectCustomer',
        registrationChannel: 'Email',
        expiresAt: '2026-12-01T12:00:00',
        usageMode: 'Single',
      }),
    );
    expect(createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        customerType: 'DirectCustomer',
        organizationMode: 'CreateChildOrg',
        childOrgType: 'Customer',
      }),
    );
    await wrapper
      .get('[data-action="invitation:createInternal"]')
      .trigger('click');
    await flushPromises();
    expect((crud.props('config') as any).dataAttrTargets.create.path).toContain(
      '/InvitationLink/createCustomer',
    );
    expect(openCreate).toHaveBeenCalledTimes(1);
    expect(createInternal).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('用户资料缺少组织时仍按 API 权限提供标准创建入口', async () => {
    user.userInfo = { tenantId: 'tenant', orgId: '' };
    const wrapper = mount(InvitationLinkPage);
    await flushPromises();
    expect(wrapper.findAll('[data-action]').length).toBe(5);
    const config = wrapper
      .findComponent({ name: 'CrudPageStub' })
      .props('config') as any;
    expect(config.allowCreate).toBe(true);
    expect(config.createButtonVisible).toBe(false);
    expect(config.description).toBe('查询、创建、复制与作废邀请链接。');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
