import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OwnershipCreateSelector from '../ownership-create-selector.vue';
const state = vi.hoisted(() => ({ userInfo: { tenantId: 'tenant-a' } as Record<string, unknown> }));
const findTenant = vi.hoisted(() => vi.fn(async () => 'tenant-a'));
const loadUsers = vi.hoisted(() => vi.fn(async () => [{ id: 'user-a', name: '人员' }]));
const getLoader = vi.hoisted(() => vi.fn(() => loadUsers));
vi.mock('ant-design-vue', () => ({ message: { warning: vi.fn() } }));
vi.mock('@vben/runtime/stores', () => ({ useUserStore: () => state }));
vi.mock('@levin/admin-framework/framework-commons/shared/crud-org-selector', () => ({
  getCrudOrgLoadApi: vi.fn(), getAuthorizedOrgTenantId: findTenant,
}));
vi.mock('@levin/admin-framework/framework-commons/shared/crud-user-selector', () => ({ getCrudUserLoadApi: getLoader }));
vi.mock('@levin/admin-framework/framework-commons/shared/user-org-selector.vue', () => ({
  default: { name: 'UserOrgSelector', props: ['modelValue', 'selectableTypes', 'disabled', 'loadUsers'], emits: ['change', 'update:modelValue'], template: '<div />' },
}));
describe('新增参与方选择', () => {
  afterEach(() => { state.userInfo = { tenantId: 'tenant-a' }; vi.clearAllMocks(); });
  it('选人同步组织，清空人员后保留组织并允许修改', async () => {
    const form = { businessOrgId: 'old', businessUserId: 'u1' };
    const props = { formState: form, field: 'businessOrgId', orgField: 'businessOrgId', userField: 'businessUserId' };
    const org = mount(OwnershipCreateSelector, { props });
    const user = mount(OwnershipCreateSelector, { props: { ...props, field: 'businessUserId' } });
    expect(org.findComponent({ name: 'UserOrgSelector' }).props('disabled')).toBe(true);
    user.findComponent({ name: 'UserOrgSelector' }).vm.$emit('change', { id: 'u2', orgId: 'new' });
    expect(form.businessOrgId).toBe('new');
    user.findComponent({ name: 'UserOrgSelector' }).vm.$emit('update:modelValue', null);
    await org.vm.$nextTick();
    expect(form.businessOrgId).toBe('new'); expect(form.businessUserId).toBe(null);
  });
  it('登录资料没有租户时，使用已授权组织解析租户后加载人员', async () => {
    state.userInfo = {};
    const form = { businessOrgId: undefined, businessUserId: undefined };
    const wrapper = mount(OwnershipCreateSelector, { props: {
      formState: form, field: 'businessUserId', orgField: 'businessOrgId', userField: 'businessUserId',
    } });
    const loader = wrapper.findComponent({ name: 'UserOrgSelector' }).props('loadUsers') as (context: { orgId: string }) => Promise<any[]>;
    expect(await loader({ orgId: 'org-a' })).toEqual([{ id: 'user-a', name: '人员', orgId: 'org-a', tenantId: 'tenant-a' }]);
    expect(findTenant).toHaveBeenCalledWith('org-a');
    expect(getLoader).toHaveBeenCalledWith(expect.anything(), '/com.levin.oak.base/V1/api', 'tenant-a');
  });
});
