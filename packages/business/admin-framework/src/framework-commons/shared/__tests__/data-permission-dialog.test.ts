import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataPermissionDialog from '../data-permission-dialog.vue';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  superAdmin: true,
  warning: vi.fn(),
}));
vi.mock('@vben/stores', () => ({ useUserStore: () => ({ userInfo: {} }) }));
vi.mock('../user-identity', () => ({
  isSuperAdminUser: () => mocks.superAdmin,
}));
vi.mock('../../runtime', () => ({
  requestClient: { get: mocks.get, put: mocks.put },
}));
vi.mock('../../app/api/rbac-service', () => ({
  rbacService: { fetchAuthorizedOrgTree: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../config-helpers', () => ({
  tenantOptionsLoader: vi.fn().mockResolvedValue([]),
}));
vi.mock('../org-scope-editor.vue', () => ({
  default: defineComponent({
    name: 'ScopeEditorStub',
    props: { value: Array },
    template: '<div />',
  }),
}));
vi.mock('ant-design-vue', () => ({
  Modal: defineComponent({
    name: 'ScopeModalStub',
    props: { open: Boolean, okButtonProps: Object },
    emits: ['ok', 'cancel'],
    template:
      '<div v-if="open"><slot/><button data-test="save" :disabled="okButtonProps?.disabled" @click="$emit(\'ok\')">保存</button></div>',
  }),
  Alert: defineComponent({
    name: 'ScopeAlertStub',
    props: { message: String },
    template: '<p>{{message}}</p>',
  }),
  Spin: defineComponent({
    name: 'ScopeSpinStub',
    template: '<div><slot/></div>',
  }),
  message: { warning: mocks.warning, success: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.superAdmin = true;
  mocks.put.mockResolvedValue({});
});
async function openDialog(
  subjectType: 'role' | 'user',
  rule: Record<string, unknown>,
) {
  mocks.get.mockResolvedValue({
    id: 'subject-1',
    optimisticLock: 7,
    name: '测试主体',
    orgScopeList: [rule],
  });
  const wrapper = mount(DataPermissionDialog, {
    props: { open: false, record: { id: 'subject-1' }, subjectType },
  });
  await wrapper.setProps({ open: true });
  await flushPromises();
  return wrapper;
}

describe('数据权限真实保存请求构造', () => {
  it.each(['role', 'user'] as const)(
    '%s预设空表达式可保存并保留模式、无租户和拒绝',
    async (subjectType) => {
      const wrapper = await openDialog(subjectType, {
        orgId: '/*',
        orgScopeMatchingMode: 'All',
        isAllow: false,
        orgScopeExpression: '',
        orgScopeExpressionType: null,
        tenantMatchingExpression: null,
      });
      expect(wrapper.text()).not.toContain('未填写完整');
      expect(
        wrapper.get('[data-test="save"]').attributes('disabled'),
      ).toBeUndefined();
      await wrapper.get('[data-test="save"]').trigger('click');
      await flushPromises();
      expect(mocks.put).toHaveBeenCalledWith(
        `/${subjectType === 'role' ? 'Role' : 'User'}/update`,
        expect.objectContaining({
          id: 'subject-1',
          optimisticLock: 7,
          forceUpdateFields: ['orgScopeList'],
          orgScopeList: [
            {
              orgId: '/*',
              orgScopeMatchingMode: 'All',
              isAllow: false,
              orgScopeExpression: '',
              orgScopeExpressionType: null,
              tenantMatchingExpression: '',
            },
          ],
        }),
      );
      wrapper.unmount();
    },
  );
  it('超管的空白自定义规则仍阻止保存', async () => {
    const wrapper = await openDialog('role', {
      orgId: '/*',
      orgScopeMatchingMode: 'Custom',
      isAllow: true,
      orgScopeExpression: ' ',
      orgScopeExpressionType: 'Groovy',
    });
    expect(wrapper.text()).toContain('未填写完整');
    expect(
      wrapper.get('[data-test="save"]').attributes('disabled'),
    ).toBeDefined();
    expect(mocks.put).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('普通用户不能通过有效自定义表达式绕过后端对应约束', async () => {
    mocks.superAdmin = false;
    const wrapper = await openDialog('user', {
      orgId: '_USER_ORG_',
      orgScopeMatchingMode: 'Custom',
      isAllow: true,
      orgScopeExpression: '/**',
      orgScopeExpressionType: 'IdPath',
    });
    await wrapper.get('[data-test="save"]').trigger('click');
    await flushPromises();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.warning).toHaveBeenCalledWith(
      '自定义组织范围只能由超级管理员保存',
    );
    wrapper.unmount();
  });
});
