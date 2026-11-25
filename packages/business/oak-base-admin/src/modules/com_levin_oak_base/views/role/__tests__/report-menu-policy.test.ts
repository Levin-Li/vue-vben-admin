import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../config', async () => {
  const { ref } = await import('vue');
  return { useRolePageConfig: () => ({
    config: ref({}), dataPermissionDialogOpen: ref(false), handleSaved: vi.fn(), pageKey: ref(1),
    resourcePermissionDialogOpen: ref(true), selectedDataPermissionRecord: ref(null),
    selectedResourcePermissionRecord: ref({ id: 'role-1' }),
  }) };
});
vi.mock('@levin/admin-framework/framework-commons/shared/resource-permission-dialog.vue', async () => {
  const { defineComponent } = await import('vue');
  return { default: defineComponent({ name: 'ResourcePermissionDialog', props: ['autoIncludeMenuAncestors'], template: '<div />' }) };
});
vi.mock('@levin/admin-framework/framework-commons/shared/data-permission-dialog.vue', () => ({ default: { template: '<div />' } }));
vi.mock('../../crud-page.vue', () => ({ default: { template: '<div />' } }));

import RolePage from '../index.vue';

describe('角色页面的报表菜单策略', () => {
  it('仅为服务端生成的具体报表启用父菜单补全', () => {
    const wrapper = mount(RolePage);
    const policy = wrapper.getComponent({ name: 'ResourcePermissionDialog' }).props('autoIncludeMenuAncestors') as (path: string) => boolean;
    expect(policy('/clob/V1/ReportView/0123456789abcdef0123456789abcdef')).toBe(true);
    expect(policy('/clob/V1/other')).toBe(false);
    wrapper.unmount();
  });
});
