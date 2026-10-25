/* eslint-disable vue/one-component-per-file -- 用KeepAlive宿主与页面替身验证重激活不会丢失草稿。 */
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, reactive, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { modelMetadataCache } from '../../data-model/model-metadata';
import RuntimePage from '../index.vue';

enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({ catalog: vi.fn() }));
const access = reactive({
  accessToken: '当前会话' as null | string,
  accessCodes: [] as string[],
});
const user = reactive({
  userInfo: {
    id: 'ordinary',
    tenantId: 'tenant-a',
    orgId: 'org-a',
    roleList: [] as unknown[],
    roles: [] as unknown[],
  },
});
const route = reactive({
  query: { modelKey: undefined as string | undefined },
  meta: { fixedQuery: { modelKey: 'invoice' as string | undefined } },
});

vi.mock('@vben/runtime/stores', () => ({
  useAccessStore: () => access,
  useUserStore: () => user,
}));

vi.mock('vue-router', () => ({
  useRoute: () => route,
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => false }),
}));
vi.mock('../../../api/data-model-service', () => ({
  dataModelService: { catalog: mocks.catalog },
}));
vi.mock('../../data-model-record/index.vue', () => ({
  default: defineComponent({
    props: { model: { type: Object, required: true } },
    setup(props) {
      const draft = ref('');
      return () =>
        h('div', { class: 'runtime-fields' }, [
          (props.model as { fields: Array<{ name: string }> }).fields
            .map((field) => field.name)
            .join(','),
          h('input', {
            class: 'local-draft',
            value: draft.value,
            onInput: (event: Event) => {
              draft.value = (event.target as HTMLInputElement).value;
            },
          }),
        ]);
    },
  }),
}));

describe('动态菜单使用当前授权目录', () => {
  beforeEach(() => {
    mocks.catalog.mockReset();
    modelMetadataCache.invalidate();
    access.accessToken = '当前会话';
    access.accessCodes = [];
    user.userInfo = {
      id: 'ordinary',
      tenantId: 'tenant-a',
      orgId: 'org-a',
      roleList: [],
      roles: [],
    };
    route.meta.fixedQuery.modelKey = 'invoice';
    route.query.modelKey = undefined;
  });

  it('只把服务端按当前主体裁剪的字段传给运行时页面', async () => {
    mocks.catalog.mockResolvedValue([
      {
        key: 'invoice',
        title: '发票',
        syncedVersion: 2,
        fields: [{ name: 'amount', title: '金额' }],
        operationFields: { QUERY: ['amount'], LIST: ['amount'] },
      },
    ]);
    const wrapper = mount(RuntimePage, {
      global: {
        stubs: { Spin: { template: '<div><slot /></div>' }, Alert: true },
      },
    });
    await flushPromises();
    expect(mocks.catalog).toHaveBeenCalledOnce();
    expect(wrapper.find('.runtime-fields').text()).toBe('amount');
    expect(wrapper.text()).not.toContain('secret');
  });

  it('目录不再返回该模型时不保留旧字段页面', async () => {
    mocks.catalog.mockResolvedValue([]);
    const wrapper = mount(RuntimePage, {
      global: {
        stubs: { Spin: { template: '<div><slot /></div>' }, Alert: true },
      },
    });
    await flushPromises();
    expect(wrapper.find('.runtime-fields').exists()).toBe(false);
  });

  it('仅模型授权且无旧静态权限仍可打开，撤权后清空原模型', async () => {
    mocks.catalog
      .mockResolvedValueOnce([
        {
          key: 'invoice',
          fields: [{ name: 'amount' }],
          operations: [{ code: 'QUERY', available: true, authorized: true }],
        },
      ])
      .mockResolvedValueOnce([]);
    const wrapper = mount(RuntimePage, {
      global: {
        stubs: { Spin: { template: '<div><slot /></div>' }, Alert: true },
      },
    });
    await flushPromises();
    expect(wrapper.find('.runtime-fields').text()).toBe('amount');
    access.accessCodes = ['已撤销模型动作'];
    await flushPromises();
    expect(wrapper.find('.runtime-fields').exists()).toBe(false);
    expect(mocks.catalog).toHaveBeenCalledTimes(2);
  });

  it('无模型参数时不展示通用目录且不发请求', async () => {
    route.meta.fixedQuery.modelKey = undefined;
    mocks.catalog.mockResolvedValue([
      { key: 'shared', title: '共享定义', fields: [] },
    ]);
    const wrapper = mount(RuntimePage, {
      global: {
        stubs: {
          Spin: { template: '<div><slot /></div>' },
          Alert: true,
          Table: true,
        },
      },
    });
    await flushPromises();
    expect(wrapper.find('.runtime-fields').exists()).toBe(false);
    expect(wrapper.find('.runtime-fields').exists()).toBe(false);
    expect(mocks.catalog).not.toHaveBeenCalled();
  });
  it('同主体凭据轮换与权限角色集合重排不卸载页面和未保存草稿', async () => {
    access.accessCodes = ['permission-b', 'permission-a'];
    user.userInfo.roleList = [
      { code: 'role-b' },
      { code: 'role-a', tenantId: 'tenant-a' },
    ];
    mocks.catalog.mockResolvedValue([
      { key: 'invoice', syncedVersion: 1, fields: [{ name: 'amount' }] },
    ]);
    const wrapper = mount(RuntimePage, {
      global: {
        stubs: { Spin: { template: '<div><slot /></div>' }, Alert: true },
      },
    });
    await flushPromises();
    await wrapper.find('input.local-draft').setValue('未保存的展示设置');
    access.accessToken = '同一主体的新凭据';
    access.accessCodes.reverse();
    user.userInfo.roleList = [
      { tenantId: 'tenant-a', code: 'role-a' },
      { code: 'role-b' },
    ];
    await flushPromises();
    expect(mocks.catalog).toHaveBeenCalledOnce();
    expect(
      (wrapper.find('input.local-draft').element as HTMLInputElement).value,
    ).toBe('未保存的展示设置');
  });

  it('登出与真实角色范围变化仍清旧投影并重验', async () => {
    user.userInfo.roleList = [{ code: 'role-a', tenantId: 'tenant-a' }];
    mocks.catalog
      .mockResolvedValueOnce([{ key: 'invoice', fields: [{ name: 'amount' }] }])
      .mockResolvedValue([]);
    const wrapper = mount(RuntimePage, {
      global: {
        stubs: { Spin: { template: '<div><slot /></div>' }, Alert: true },
      },
    });
    await flushPromises();
    user.userInfo.roleList = [{ code: 'role-a', tenantId: 'tenant-b' }];
    await flushPromises();
    expect(wrapper.find('.runtime-fields').exists()).toBe(false);
    expect(mocks.catalog).toHaveBeenCalledTimes(2);
    access.accessToken = null;
    await flushPromises();
    expect(wrapper.find('.runtime-fields').exists()).toBe(false);
    expect(mocks.catalog).toHaveBeenCalledTimes(3);
  });

  it('空固定参数允许校验后的query模型链接，固定模型参数优先', async () => {
    route.meta.fixedQuery.modelKey = undefined;
    route.query.modelKey = 'shared';
    mocks.catalog.mockResolvedValue([
      { key: 'shared', fields: [{ name: 'visible' }] },
      { key: 'invoice', fields: [{ name: 'amount' }] },
    ]);
    const wrapper = mount(RuntimePage, {
      global: {
        stubs: { Spin: { template: '<div><slot /></div>' }, Alert: true },
      },
    });
    await flushPromises();
    expect(wrapper.find('.runtime-fields').text()).toBe('visible');
    route.meta.fixedQuery.modelKey = 'invoice';
    await flushPromises();
    expect(wrapper.find('.runtime-fields').text()).toBe('amount');
  });
  it('同同步版本的新授权投影重建页面，不沿用旧字段配置和草稿', async () => {
    mocks.catalog
      .mockResolvedValueOnce([
        { key: 'invoice', syncedVersion: 1, fields: [{ name: 'secret' }] },
      ])
      .mockResolvedValue([
        { key: 'invoice', syncedVersion: 1, fields: [{ name: 'public' }] },
      ]);
    const active = ref(true);
    const Host = defineComponent({
      setup: () => () =>
        h(KeepAlive, null, {
          default: () => (active.value ? h(RuntimePage) : null),
        }),
    });
    const wrapper = mount(Host, {
      global: {
        stubs: { Spin: { template: '<div><slot /></div>' }, Alert: true },
      },
    });
    await flushPromises();
    await wrapper.find('input.local-draft').setValue('旧授权草稿');
    active.value = false;
    await flushPromises();
    modelMetadataCache.invalidate();
    active.value = true;
    await flushPromises();
    expect(wrapper.find('.runtime-fields').text()).toBe('public');
    expect(
      (wrapper.find('input.local-draft').element as HTMLInputElement).value,
    ).toBe('');
  });
});
