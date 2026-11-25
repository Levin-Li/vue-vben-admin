import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { PartyOwnershipGroup } from '../party-ownership-types';
import PartyOwnershipPanel from '../party-ownership-panel.vue';

vi.mock('ant-design-vue', () => ({
  message: { warning: vi.fn() },
}));
vi.mock('../user-org-selector.vue', () => ({
  default: { name: 'UserOrgSelector', props: ['modelValue', 'selectableTypes', 'disabled', 'allowClear', 'userApiModuleBase', 'resolveRecords'],
    emits: ['change', 'update:modelValue'], template: '<div />' },
}));

function group(overrides: Partial<PartyOwnershipGroup> = {}): PartyOwnershipGroup {
  return { key: 'operation', label: '运营', orgLabel: '运营团队', userLabel: '运营人员',
    orgField: 'operationOrgId', userField: 'operationUserId', bound: false,
    canReadOrg: true, canReadUser: true, canWriteOrg: true, canWriteUser: true,
    canBind: true, canAdjust: false, ...overrides };
}

describe('归属管理面板', () => {
  it('选人自动带出组织并锁定组织，统一收集变更', async () => {
    const wrapper = mount(PartyOwnershipPanel, { props: { groups: [group()], userApiModuleBase: '/base/V1/api' } });
    const selectors = wrapper.findAllComponents({ name: 'UserOrgSelector' });
    expect(selectors[0]!.props('allowClear')).toBe(false);
    expect(selectors[1]!.props('userApiModuleBase')).toBe('/base/V1/api');
    expect(selectors[1]!.props('resolveRecords')).toEqual(expect.any(Function));
    expect(wrapper.findAll('h3')).toHaveLength(0);
    expect(wrapper.text()).toContain('运营团队');
    expect(wrapper.text()).toContain('运营人员');
    selectors[1]!.vm.$emit('change', { id: 'u1', kind: 'user', name: '测试', orgId: 'org1' });
    await wrapper.vm.$nextTick();
    expect(selectors[0]!.props('modelValue')).toBe('org1');
    expect(selectors[0]!.props('disabled')).toBe(true);
    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.vm.collectChanges()).toEqual([expect.objectContaining({ group: 'operation', operation: 'bind', orgId: 'org1', userId: 'u1' })]);
    selectors[1]!.vm.$emit('change', null);
    await wrapper.vm.$nextTick();
    expect(selectors[0]!.props('disabled')).toBe(false);
    expect(selectors[0]!.props('modelValue')).toBe('org1');
  });

  it('授权变化后立即更新操作', async () => {
    const wrapper = mount(PartyOwnershipPanel, { props: { groups: [group({ bound: true, orgId: 'org1' })] } });
    expect(wrapper.findAllComponents({ name: 'UserOrgSelector' })[0]!.props('disabled')).toBe(true);
    await wrapper.setProps({ groups: [group({ bound: true, orgId: 'org1', canAdjust: true })] });
    expect(wrapper.findAllComponents({ name: 'UserOrgSelector' })[0]!.props('disabled')).toBe(false);
  });

  it('没有字段授权的组不可见，绑定后没有调整授权时不显示操作', () => {
    const hidden = group({ key: 'hidden', label: '隐藏组', canReadOrg: false, canReadUser: false,
      canWriteOrg: false, canWriteUser: false });
    const wrapper = mount(PartyOwnershipPanel, { props: { groups: [hidden, group({ bound: true, orgId: 'org1' })] } });
    expect(wrapper.text()).not.toContain('隐藏组');
    expect(wrapper.text()).toContain('运营');
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('多组一次收集，部分保存后保留尚未保存的草稿', async () => {
    const other = group({ key: 'business', label: '商务', orgField: 'businessOrgId', userField: 'businessUserId' });
    const wrapper = mount(PartyOwnershipPanel, { props: { groups: [group(), other], resetKey: 'one' } });
    const selectors = wrapper.findAllComponents({ name: 'UserOrgSelector' });
    selectors[0]!.vm.$emit('update:modelValue', 'org-1');
    selectors[2]!.vm.$emit('update:modelValue', 'org-2');
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.collectChanges()).toHaveLength(2);
    await wrapper.setProps({ groups: [group({ bound: true, orgId: 'org-1' }), other] });
    expect(wrapper.vm.collectChanges()).toEqual([expect.objectContaining({ group: 'business', orgId: 'org-2' })]);
    await wrapper.setProps({ resetKey: 'other-user' });
    expect(wrapper.vm.collectChanges()).toEqual([]);
  });

  it('字段不可读时，成功保存的组不会被重复提交', async () => {
    const hiddenOrg = group({ canReadOrg: false });
    const wrapper = mount(PartyOwnershipPanel, { props: { groups: [hiddenOrg] } });
    wrapper.findAllComponents({ name: 'UserOrgSelector' })[0]!.vm.$emit('update:modelValue', 'org-1');
    await wrapper.vm.$nextTick();
    const change = wrapper.vm.collectChanges()[0]!;
    wrapper.vm.markCommitted(change);
    await wrapper.setProps({ groups: [group({ canReadOrg: false, bound: true })] });
    expect(wrapper.vm.collectChanges()).toEqual([]);
  });

  it('提交期间的新修改不会被当作已保存', async () => {
    const wrapper = mount(PartyOwnershipPanel, { props: { groups: [group()] } });
    const selector = wrapper.findAllComponents({ name: 'UserOrgSelector' })[0]!;
    selector.vm.$emit('update:modelValue', 'org-1'); await wrapper.vm.$nextTick();
    const submitted = wrapper.vm.collectChanges()[0]!;
    selector.vm.$emit('update:modelValue', 'org-2'); await wrapper.vm.$nextTick();
    wrapper.vm.markCommitted(submitted);
    await wrapper.setProps({ groups: [group({ bound: true, orgId: 'org-1', canAdjust: true })] });
    expect(wrapper.vm.collectChanges()).toEqual([expect.objectContaining({ group: 'operation', orgId: 'org-2' })]);
  });
});
