import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import OwnershipRowAction from '../ownership-row-action.vue';

const identity = vi.hoisted(() => ({ userInfo: { id: 'u', tenantId: 'tenant', superAdmin: false } }));
vi.mock('ant-design-vue', () => ({
  Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
}));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => identity,
  useAccessStore: () => ({ accessCodes: [] }),
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock('@levin/admin-framework/framework-commons/shared/crud-permissions', () => ({
  buildApiMethodPermissions: () => ['allowed'],
}));
vi.mock('@levin/admin-framework/framework-commons/shared/crud-editable-access', () => ({
  canMutateCrudRecord: (_fields: unknown, record: { editable?: boolean }, user: { superAdmin?: boolean }) =>
    record.editable !== false || user.superAdmin === true,
}));
vi.mock('@levin/admin-framework/framework-commons/shared/party-ownership-dialog.vue', () => ({
  default: { name: 'PartyOwnershipDialog', props: ['open', 'tenantId', 'canBind', 'canAdjust', 'readOnlyReason'], template: '<div />' },
}));

describe('归属列表操作', () => {
  it('显示绑定归属并打开统一弹窗', async () => {
    const service = { bindOwnershipStatus: vi.fn(), adjustOwnershipStatus: vi.fn(), bindOwnership: vi.fn(), adjustOwnership: vi.fn() };
    const wrapper = mount(OwnershipRowAction, { props: {
      record: { id: 'one' }, reload: vi.fn(async () => {}), service,
      resource: 'Customer', label: '客户', descriptors: [],
    } });
    expect(wrapper.get('button').text()).toBe('绑定归属');
    await wrapper.get('button').trigger('click');
    expect(wrapper.getComponent({ name: 'PartyOwnershipDialog' }).props('open')).toBe(true);
    expect(wrapper.getComponent({ name: 'PartyOwnershipDialog' }).props('tenantId')).toBe('tenant');
  });
  it('记录不可编辑时保留查看入口但不授予写操作', async () => {
    const service = { bindOwnershipStatus: vi.fn(), adjustOwnershipStatus: vi.fn(), bindOwnership: vi.fn(), adjustOwnership: vi.fn() };
    const wrapper = mount(OwnershipRowAction, { props: {
      record: { id: 'one', editable: false }, reload: vi.fn(async () => {}), service,
      resource: 'LegalSubject', label: '法律主体', descriptors: [],
    } });
    await wrapper.get('button').trigger('click');
    const dialog = wrapper.getComponent({ name: 'PartyOwnershipDialog' });
    expect(dialog.props('canBind')).toBe(true);
    expect(dialog.props('canAdjust')).toBe(true);
    expect(dialog.props('readOnlyReason')).toBe('此记录不可编辑');
    expect(service.bindOwnershipStatus).not.toHaveBeenCalled();
  });
});
