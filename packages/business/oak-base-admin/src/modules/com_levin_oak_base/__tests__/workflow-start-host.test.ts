import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowStart from '../views/workflow-start/index.vue';

// 宿主测试仅替换公开公共组件，保留真实身份判断和各 API 方法权限传递。
const state = vi.hoisted(() => ({
  actor: {} as Record<string, unknown>,
  has: vi.fn(),
  ready: { value: true },
  token: { value: 'qa-session' },
}));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: state.actor }),
  useAccessStore: () => ({
    get accessToken() {
      return state.token.value;
    },
  }),
}));
vi.mock('@levin/admin-framework/framework-commons/data-attr-policy', () => ({
  isDataAttrPolicyReady: () => state.ready.value,
}));
vi.mock('@levin/admin-framework', () => ({
  UserOrgSelector: {
    name: 'UserOrgSelector',
    emits: ['update:selectedRecords'],
    template:
      "<button @click=\"$emit('update:selectedRecords', [{ id: 'o1', tenantId: 't1', type: 'org' }])\">选择授权组织</button>",
  },
}));
vi.mock('@levin/bpm-runtime-ui', () => ({
  WorkflowStartWorkbench: {
    name: 'WorkflowStartWorkbench',
    props: [
      'tenantId',
      'canReadCatalog',
      'canReadRecords',
      'canReadEligibility',
      'canStart',
    ],
    template: '<section>{{ tenantId }}</section>',
  },
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: state.has }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, method: string) => [method],
  }),
);
vi.mock('../api/workflow-runtime-service', () => ({
  workflowRuntimeService: {},
}));
vi.mock('../api/workflow-request-service', () => ({
  loadWorkflowRequestOrgTree: vi.fn(),
}));

describe('发起流程宿主范围与权限', () => {
  beforeEach(() => {
    state.has.mockReturnValue(true);
    state.ready = ref(true);
    state.token = ref('qa-session');
  });
  it('会话及授权均就绪才挂载发起组件，退出立即卸载并丢弃旧组件状态', async () => {
    state.actor = { tenantId: 'own-tenant' };
    state.ready.value = false;
    const wrapper = mount(WorkflowStart);
    const exists = () =>
      wrapper.findComponent({ name: 'WorkflowStartWorkbench' }).exists();
    expect(exists()).toBe(false);
    state.ready.value = true;
    await flushPromises();
    expect(exists()).toBe(true);
    state.token.value = '';
    await flushPromises();
    expect(exists()).toBe(false);
    state.token.value = 'next-session';
    await flushPromises();
    expect(exists()).toBe(true);
    wrapper.unmount();
  });
  it.each([
    'platformUser',
    'isPlatformUser',
    'superAdmin',
    'isSuperAdmin',
    'platformAdmin',
    'isPlatformAdmin',
  ])('%s身份可查询平台全局流程，并能从授权组织切换业务范围', async (flag) => {
    state.actor = { [flag]: true };
    const wrapper = mount(WorkflowStart);
    await flushPromises();
    expect(
      wrapper.findComponent({ name: 'WorkflowStartWorkbench' }).exists(),
    ).toBe(true);
    expect(wrapper.find('[data-form-id="workflow-start-scope"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('.ant-form-item-label').text()).toContain('业务范围');
    expect(wrapper.find('.ant-card').exists()).toBe(false);
    await wrapper.findComponent({ name: 'UserOrgSelector' }).trigger('click');
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'WorkflowStartWorkbench' })
        .props('tenantId'),
    ).toBe('t1');
    wrapper.unmount();
  });
  it('普通租户直接使用当前会话租户且逐项传递方法权限', async () => {
    state.actor = { tenantId: 'own-tenant' };
    state.has.mockImplementation(
      ([method]: string[]) => method !== 'eligibility',
    );
    const wrapper = mount(WorkflowStart);
    await flushPromises();
    expect(wrapper.findComponent({ name: 'UserOrgSelector' }).exists()).toBe(
      false,
    );
    expect(
      wrapper.findComponent({ name: 'WorkflowStartWorkbench' }).props(),
    ).toMatchObject({
      tenantId: 'own-tenant',
      canReadCatalog: true,
      canReadRecords: true,
      canReadEligibility: false,
      canStart: true,
    });
    wrapper.unmount();
  });
});
