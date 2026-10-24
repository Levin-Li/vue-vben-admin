/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, onMounted, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import InvitationLinkPage from '../index.vue';

const {
  list,
  copyLink,
  createCustomer,
  createInternal,
  writeText,
  permissionAllowed,
} = vi.hoisted(() => ({
  list: vi.fn(),
  copyLink: vi.fn(),
  createCustomer: vi.fn(),
  createInternal: vi.fn(),
  writeText: vi.fn(),
  permissionAllowed: vi.fn(),
}));

vi.mock('../../../api/invitation-link-service', () => ({
  invitationLinkService: {
    list,
    copyLink,
    createInternal,
    createCustomer,
    createMember: vi.fn(),
    createSupplierPartner: vi.fn(),
    createChannelPartner: vi.fn(),
    canInviteChildAdmin: vi.fn(),
    retrieve: vi.fn(),
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
        expose({ reload: () => load() });
        onMounted(() => void load());
        return () =>
          h('main', [
            slots['toolbar-extra']?.({ isListOperationVisible: () => true }),
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
    permissionAllowed.mockImplementation(
      (method: string) => method !== 'canInviteChildAdmin',
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

  it('切换邀请目标后公共新增使用对应权限、字段策略和独立创建方法', async () => {
    const wrapper = mount(InvitationLinkPage);
    await flushPromises();
    const crud = wrapper.findComponent({ name: 'CrudPageStub' });
    expect((crud.props('config') as any).dataAttrTargets.create.path).toContain(
      '/InvitationLink/createInternal',
    );
    await wrapper.get('[data-target="Customer"]').trigger('click');
    await flushPromises();
    const config = crud.props('config') as any;
    expect(config.createPermission).toBe('createCustomer');
    expect(config.dataAttrTargets.create.path).toContain(
      '/InvitationLink/createCustomer',
    );
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
    expect(createInternal).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
