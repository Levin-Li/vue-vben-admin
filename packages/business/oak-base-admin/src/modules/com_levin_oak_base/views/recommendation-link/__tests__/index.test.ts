import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { list, copyLink, writeText, permissionAllowed } = vi.hoisted(() => ({
  list: vi.fn(),
  copyLink: vi.fn(),
  writeText: vi.fn(),
  permissionAllowed: vi.fn(),
}));

vi.mock('../../../api/recommendation-link-service', () => ({
  recommendationLinkService: {
    list,
    copyLink,
    createInternal: vi.fn(),
    createMember: vi.fn(),
    createCustomer: vi.fn(),
    createSupplierPartner: vi.fn(),
    createChannelPartner: vi.fn(),
    canInviteChildAdmin: vi.fn(),
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
vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({ template: '<main><slot /></main>' }),
}));
vi.mock('ant-design-vue', () => ({
  Alert: defineComponent({ template: '<div />' }),
  Button: defineComponent({
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  }),
  Form: Object.assign(defineComponent({ template: '<div><slot /></div>' }), {
    Item: defineComponent({ template: '<div><slot /></div>' }),
  }),
  Input: defineComponent({ template: '<input />' }),
  InputNumber: defineComponent({ template: '<input />' }),
  Modal: defineComponent({
    props: { open: Boolean },
    template: '<div v-if="open"><slot /></div>',
  }),
  Select: defineComponent({
    props: { options: Array },
    template:
      '<div class="select-options"><span v-for="item in options" :key="item.value">{{ item.label }}</span></div>',
  }),
  Tag: defineComponent({ template: '<span><slot /></span>' }),
  Table: defineComponent({
    props: { dataSource: Array },
    setup(props, { slots }) {
      return () =>
        h(
          'section',
          (props.dataSource || []).map((record) =>
            h(
              'div',
              { class: 'row' },
              slots.bodyCell?.({ column: { key: 'actions' }, record }),
            ),
          ),
        );
    },
  }),
  message: { success: vi.fn(), error: vi.fn() },
}));

describe('推荐链接列表翻页', () => {
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
  });

  it('加载第二页后可再次复制旧链接', async () => {
    const { default: component } = await import('../index.vue');
    const wrapper = mount(component);
    await flushPromises();
    expect(list).toHaveBeenNthCalledWith(1, { pageIndex: 1, pageSize: 20 });
    const loadMore = wrapper
      .findAll('button')
      .find((button) => button.text() === '加载更多');
    if (!loadMore) throw new Error('第一页后缺少加载更多入口');
    await loadMore.trigger('click');
    await flushPromises();
    expect(list).toHaveBeenNthCalledWith(2, { pageIndex: 2, pageSize: 20 });
    const oldRow = wrapper.findAll('.row')[1];
    if (!oldRow) throw new Error('第二页旧链接没有出现');
    await oldRow.get('button').trigger('click');
    await flushPromises();
    expect(copyLink).toHaveBeenCalledWith('older');
    expect(writeText).toHaveBeenCalledWith(
      'https://example.test/invite?token=older',
    );
    wrapper.unmount();
  });

  it('无子组织管理员附加权限时仅提供普通用户选项', async () => {
    const { default: component } = await import('../index.vue');
    const wrapper = mount(component);
    await flushPromises();
    const createButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '创建邀请链接');
    if (!createButton) throw new Error('缺少创建邀请入口');
    await createButton.trigger('click');
    const userTypeOptions = wrapper
      .findAll('.select-options')
      .find((item) => item.text().includes('普通用户'));
    expect(userTypeOptions?.text()).toContain('普通用户');
    expect(userTypeOptions?.text()).not.toContain('子组织管理员');
    wrapper.unmount();
  });
});
