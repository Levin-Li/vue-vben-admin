import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import DomainPage from '../index.vue';

const mocks = vi.hoisted(() => ({
  operationProfile: vi.fn(),
  providerOptions: vi.fn(async () => []),
  tenantOptions: vi.fn(async () => []),
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@vben/runtime/icons', () => ({ IconifyIcon: { render: () => null } }));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: { platformUser: true } }),
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({ buildApiMethodPermissions: () => [] }),
);
vi.mock('../../../api/domain-service', () => ({
  domainService: { operationProfile: mocks.operationProfile },
}));
vi.mock('../../api-module', () => ({
  getTenantSiteSuffixApplyApi: vi.fn(),
  getTenantSiteVendorApplyApi: vi.fn(),
  getTenantSiteVendorDomainRenewBeforeDays: vi.fn(),
  getTenantSiteVendorOnboardingGuidance: vi.fn(),
  getTenantSiteVendorSuffixOptions: () => [],
  tenantOptionsLoader: mocks.tenantOptions,
  tenantSiteVendorOptionsLoader: mocks.providerOptions,
}));
vi.mock('../config', () => ({ domainPageCrudConfig: {} }));
vi.mock('../dns-record-manager.vue', () => ({ default: {} }));
vi.mock('../../crud-page.vue', () => ({
  default: defineComponent({
    name: 'CrudPage',
    props: { config: { type: Object, required: true } },
    template:
      '<div><slot name="toolbar-extra" :is-list-operation-visible="() => true" /></div>',
  }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function createPage() {
  return mount(DomainPage, {
    global: { stubs: { Button: { template: '<button><slot /></button>' } } },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
});

describe('域名行操作画像请求', () => {
  it('合并同一行渲染期间的重复查询，并在完成后复用画像', async () => {
    const request = deferred<any>();
    mocks.operationProfile.mockReturnValue(request.promise);
    const wrapper = createPage();
    const actions = wrapper
      .findComponent({ name: 'CrudPage' })
      .props('config')
      .rowActions.slice(3);
    const record = { id: 'domain-1' };
    for (let render = 0; render < 4; render++)
      actions.forEach((action: any) =>
        expect(action.visible(record)).toBe(false),
      );
    expect(mocks.operationProfile).toHaveBeenCalledTimes(1);
    request.resolve({
      operations: {
        dnsRecords: { visible: true, enabled: true },
        renew: { visible: false },
      },
    });
    await flushPromises();
    expect(actions[0].visible(record)).toBe(true);
    expect(actions[2].visible(record)).toBe(false);
    await actions[0].handler(record);
    expect(mocks.operationProfile).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
  it('不同行独立请求，失败画像不随渲染循环重试', async () => {
    mocks.operationProfile.mockRejectedValue(new Error('加载失败'));
    const wrapper = createPage();
    const actions = wrapper
      .findComponent({ name: 'CrudPage' })
      .props('config')
      .rowActions.slice(3);
    for (const id of ['domain-1', 'domain-2'])
      actions.forEach((action: any) => action.visible({ id }));
    await flushPromises();
    for (const id of ['domain-1', 'domain-2'])
      actions.forEach((action: any) =>
        expect(action.visible({ id })).toBe(false),
      );
    expect(mocks.operationProfile).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
  it('申请弹窗选项目录在首次打开时加载并在重复打开时复用', async () => {
    const wrapper = createPage();
    await flushPromises();
    expect(mocks.providerOptions).not.toHaveBeenCalled();
    expect(mocks.tenantOptions).not.toHaveBeenCalled();
    const button = wrapper
      .findAll('button')
      .find((item) => item.text().includes('申请域名'));
    if (!button) throw new Error('申请入口未显示');
    await button.trigger('click');
    await flushPromises();
    await button.trigger('click');
    await flushPromises();
    expect(mocks.providerOptions).toHaveBeenCalledTimes(1);
    expect(mocks.tenantOptions).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
