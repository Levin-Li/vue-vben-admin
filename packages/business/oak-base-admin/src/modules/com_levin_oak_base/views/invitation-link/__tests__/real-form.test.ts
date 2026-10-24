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
  useRbacAccess: () => ({ hasPermission: () => true }),
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
  // 公共 RequestService 通过 request() 发送请求，测试替身按方法转交现有断言记录。
  mocks.request.mockImplementation(
    (path: string, options: { method: string }) =>
      options.method === 'GET'
        ? mocks.get(path, options)
        : mocks.post(path, options),
  );
  mocks.get.mockResolvedValue([]);
  mocks.post.mockImplementation(async (path: string) =>
    path.endsWith('/list')
      ? { items: [], total: 0 }
      : { id: 'new-invitation', url: 'https://example.test/invite?token=test' },
  );
});
afterEach(() => {
  wrapper?.unmount();
});

describe('邀请真实公共表单提交', () => {
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
    const selects = modal.findAllComponents(Select);
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
    const date = modal
      .findAllComponents(DatePicker)
      .find((picker) => picker.props('showTime'));
    if (!date) throw new Error('缺少实际控件：date');
    date.vm.$emit(
      'update:value',
      new Date(Date.now() + 86_400_000).toISOString().slice(0, 19),
    );
    await flushPromises();
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
      userType: 'Employee',
      organizationMode: 'JoinInviterOrg',
      usageMode: 'Limited',
      maxRegistrations: 10,
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
    const customerDate = customerModal
      .findAllComponents(DatePicker)
      .find((picker) => picker.props('showTime'));
    if (!customerDate) throw new Error('缺少到期日期控件');
    customerDate.vm.$emit(
      'update:value',
      new Date(Date.now() + 86_400_000).toISOString().slice(0, 19),
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
      userType: 'Employee',
      organizationMode: 'CreateChildOrg',
      childOrgType: 'Customer',
      customerType: 'DirectCustomer',
      usageMode: 'Single',
    });
    expect(customerSubmitted[1].data).not.toHaveProperty('channelPartnerId');
    expect(customerSubmitted[1].data).not.toHaveProperty('maxRegistrations');
    expect(mocks.error).not.toHaveBeenCalled();
  }, 20_000);
});
