import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';

import { getServiceMeta } from '@levin/admin-framework';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withUserPageScope } from '../api/user-page-scope';
import { UserService, userService } from '../api/user-service';
import UserPage from '../views/user/index.vue';

const calls = vi.hoisted(() => ({
  request: vi.fn(),
  organizations: vi.fn(),
  unmounted: vi.fn(),
  actor: {} as Record<string, unknown>,
}));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({
    get userInfo() {
      return calls.actor;
    },
  }),
}));
vi.mock('@levin/admin-framework', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@levin/admin-framework')>();
  return {
    ...actual,
    rbacService: { fetchAuthorizedOrgTree: calls.organizations },
    UserOrgSelector: {
      name: 'UserOrgSelector',
      props: ['loadOrgTree'],
      emits: ['update:selectedRecords'],
      template: '<div>授权组织选择</div>',
    },
    RequestService: class {
      get(path: string, options: Record<string, unknown> = {}) {
        return this.request({ ...options, path, method: 'GET' });
      }
      post(path: string, options: Record<string, unknown> = {}) {
        return this.request({ ...options, path, method: 'POST' });
      }
      put(path: string, options: Record<string, unknown> = {}) {
        return this.request({ ...options, path, method: 'PUT' });
      }
      request(options: Record<string, unknown>) {
        return calls.request(options);
      }
    },
  };
});
vi.mock(
  '@levin/admin-framework/framework-commons/shared/data-permission-dialog.vue',
  () => ({ default: { template: '<div />' } }),
);
vi.mock('../views/crud-page.vue', async () => {
  const { onBeforeUnmount } = await import('vue');
  return {
    default: {
      name: 'CrudPage',
      props: ['config'],
      setup() {
        onBeforeUnmount(calls.unmounted);
      },
      template: '<div>用户列表<slot name="search-field-orgId" /></div>',
    },
  };
});

describe('普通用户原页面选择授权组织', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.actor = reactive({
      id: 'reader',
      tenantId: 'tenant',
      orgId: 'parent',
    });
    calls.request.mockResolvedValue({ items: [], totals: 0 });
    calls.organizations.mockResolvedValue([
      { id: 'child', tenantId: 'tenant', kind: 'org' },
    ]);
  });

  it('同一服务类型保留真实方法元数据，列表详情更新固定当前单选组织且不改输入对象', async () => {
    const scope = { tenantId: 'tenant', orgId: 'child' };
    const service = new UserService(
      () => scope,
      () => calls.actor,
    );
    expect(getServiceMeta(service)).toEqual(getServiceMeta(userService));
    for (const method of ['list', 'retrieve', 'update']) {
      expect(buildApiMethodPermissions(service, method)).toEqual(
        buildApiMethodPermissions(userService, method),
      );
    }
    const params = { pageIndex: 1, orgIdList: ['parent', 'other'] };
    await service.list(params);
    await service.retrieve({ id: 'target' });
    await service.update({ id: 'target', name: '更新', orgIdList: ['other'] });
    expect(calls.request.mock.calls[0]?.[0].params).toEqual({
      pageIndex: 1,
      orgIdList: ['child'],
    });
    expect(calls.request.mock.calls[1]?.[0].params).toEqual({
      id: 'target',
      orgIdList: ['child'],
    });
    expect(calls.request.mock.calls[2]?.[0].data).toEqual({
      id: 'target',
      name: '更新',
      orgIdList: ['child'],
    });
    expect(calls.request.mock.calls[2]?.[0].params).toEqual({
      orgIdList: ['child'],
    });
    expect(params.orgIdList).toEqual(['parent', 'other']);
  });

  it('普通页面可选组织仅来自授权树，切换重新挂载旧记录与流程抽屉', async () => {
    const wrapper = mount(UserPage);
    expect(wrapper.text()).not.toContain('用户查询组织');
    const picker = wrapper.findComponent({ name: 'UserOrgSelector' });
    await picker.props('loadOrgTree')();
    expect(calls.organizations).toHaveBeenCalledWith({ assembleTree: true });
    const previous = wrapper.findComponent({ name: 'CrudPage' }).vm;
    picker.vm.$emit('update:selectedRecords', [
      { id: 'child', tenantId: 'tenant', kind: 'org' },
    ]);
    await flushPromises();
    expect(calls.unmounted).toHaveBeenCalledOnce();
    const next = wrapper.findComponent({ name: 'CrudPage' });
    expect(next.vm).not.toBe(previous);
    await next.props('config').apiService.list({ pageIndex: 1 });
    expect(calls.request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        params: { pageIndex: 1, orgIdList: ['child'] },
      }),
    );
    wrapper.unmount();
  });

  it('跨租户引用在前端拒绝，后台拒绝组织时传播错误且不回退全部组织', async () => {
    expect(() =>
      withUserPageScope(
        { path: 'list' },
        { orgId: 'other', tenantId: 'other' },
        calls.actor,
      ),
    ).toThrow('当前会话租户');
    const service = new UserService(
      () => ({ orgId: 'child', tenantId: 'tenant' }),
      () => calls.actor,
    );
    calls.request.mockRejectedValue(new Error('当前用户无目标组织访问权限'));
    await expect(service.list({})).rejects.toThrow('无目标组织访问权限');
    expect(calls.request).toHaveBeenCalledOnce();
    expect(() =>
      withUserPageScope(
        { path: 'list', params: { tenantId: 'other' } },
        { orgId: 'child', tenantId: 'tenant' },
        calls.actor,
      ),
    ).toThrow('请求租户');
  });

  it('请求发出即固定所选范围，后续选择不改写旧请求；未选择仍保持默认组织行为', async () => {
    let scope: undefined | { orgId: string; tenantId: string };
    const service = new UserService(
      () => scope,
      () => calls.actor,
    );
    await service.list({ pageIndex: 1 });
    expect(calls.request.mock.calls[0]?.[0].params).toEqual({ pageIndex: 1 });
    let resolve!: (value: unknown) => void;
    calls.request.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    scope = { orgId: 'child', tenantId: 'tenant' };
    const pending = service.list({});
    scope = { orgId: 'parent', tenantId: 'tenant' };
    await service.list({});
    expect(calls.request.mock.calls[1]?.[0].params.orgIdList).toEqual([
      'child',
    ]);
    expect(calls.request.mock.calls[2]?.[0].params.orgIdList).toEqual([
      'parent',
    ]);
    resolve({ items: [], totals: 0 });
    await pending;
  });
});
