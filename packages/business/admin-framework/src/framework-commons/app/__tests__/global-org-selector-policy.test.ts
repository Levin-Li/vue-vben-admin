import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import GlobalOrgSelector from '../global-org-selector.vue';

const state = vi.hoisted(() => ({
  runtime: { enabled: true, valueContent: {} as Record<string, any> },
  selected: undefined as any,
  user: {} as Record<string, any>,
}));
const setCurrentGlobalUserOrgRecords = vi.hoisted(() => vi.fn());

vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: state.user }),
}));
vi.mock('../../shared/user-org-selector.vue', () => ({
  default: defineComponent({
    name: 'UserOrgSelector',
    props: [
      'allowClear',
      'allowSelectOrg',
      'allowSelectUser',
      'maxSelectCount',
      'mode',
      'multiple',
      'orgTypes',
      'userApiModuleBase',
      'userTypes',
    ],
    emits: ['loaded', 'update:selected-records'],
    setup(_props, { attrs }) {
      return () => h('div', { ...attrs, 'data-testid': 'selector' });
    },
  }),
}));
vi.mock('../global-org-context-state', () => ({
  currentGlobalUserOrgRecords: {
    get value() {
      return state.selected ? [state.selected] : [];
    },
  },
  setCurrentGlobalUserOrgRecords,
}));
vi.mock('../global-org-selector-runtime', () => ({
  globalOrgSelectorRuntimeState: state.runtime,
}));

const records = [
  { id: 'org-1', kind: 'org', orgId: 'org-1' },
  { id: 'org-2', kind: 'org', orgId: 'org-2' },
];

describe('global org selector policy', () => {
  beforeEach(() => {
    state.runtime.enabled = true;
    state.runtime.valueContent = {};
    state.selected = undefined;
    state.user = {};
    setCurrentGlobalUserOrgRecords.mockReset();
  });
  it('服务端关闭时不挂载底层选择器', () => {
    state.runtime.enabled = false;
    const wrapper = mount(GlobalOrgSelector);
    expect(wrapper.findComponent({ name: 'UserOrgSelector' }).exists()).toBe(
      false,
    );
    expect(setCurrentGlobalUserOrgRecords).not.toHaveBeenCalled();
  });

  it('关闭后迟到的候选与选中事件不恢复全局状态', async () => {
    const wrapper = mount(GlobalOrgSelector);
    const selector = wrapper.findComponent({ name: 'UserOrgSelector' });
    state.runtime.enabled = false;
    await selector.vm.$emit('loaded', records);
    await selector.vm.$emit('update:selected-records', records);
    expect(setCurrentGlobalUserOrgRecords).not.toHaveBeenCalled();
  });

  it('hides a normal user single candidate without auto selection', async () => {
    const wrapper = mount(GlobalOrgSelector);
    await wrapper
      .findComponent({ name: 'UserOrgSelector' })
      .vm.$emit('loaded', [records[0]]);
    expect(setCurrentGlobalUserOrgRecords).not.toHaveBeenCalled();
    expect(
      wrapper.get('[data-testid="global-user-org-selector"]').classes(),
    ).toContain('hidden');
  });
  it('keeps normal user multiple candidates empty and forbids clear', async () => {
    const wrapper = mount(GlobalOrgSelector);
    await wrapper
      .findComponent({ name: 'UserOrgSelector' })
      .vm.$emit('loaded', records);
    expect(setCurrentGlobalUserOrgRecords).not.toHaveBeenCalled();
    expect(
      wrapper.findComponent({ name: 'UserOrgSelector' }).props('allowClear'),
    ).toBe(false);
  });
  it('hides for a normal user with no candidates', async () => {
    const wrapper = mount(GlobalOrgSelector);
    await wrapper
      .findComponent({ name: 'UserOrgSelector' })
      .vm.$emit('loaded', []);
    expect(
      wrapper.get('[data-testid="global-user-org-selector"]').classes(),
    ).toContain('hidden');
  });
  it('honors server clear restriction for administrators', () => {
    state.user = { superAdmin: true };
    expect(
      mount(GlobalOrgSelector)
        .findComponent({ name: 'UserOrgSelector' })
        .props('allowClear'),
    ).toBe(true);
    state.runtime.valueContent = { allowClear: false };
    expect(
      mount(GlobalOrgSelector)
        .findComponent({ name: 'UserOrgSelector' })
        .props('allowClear'),
    ).toBe(false);
  });
  it('clears the global context when an administrator clears the selector', async () => {
    state.user = { superAdmin: true };
    const wrapper = mount(GlobalOrgSelector);
    await wrapper
      .findComponent({ name: 'UserOrgSelector' })
      .vm.$emit('update:selected-records', []);
    expect(setCurrentGlobalUserOrgRecords).toHaveBeenCalledWith([], false);
  });
  it('forwards server candidate restrictions without widening them', () => {
    state.runtime.valueContent = {
      allowSelectOrg: false,
      allowSelectUser: true,
      orgTypes: ['总部'],
      userApiModuleBase: '/com.example/V1/api',
      userTypes: ['员工'],
    };
    const selector = mount(GlobalOrgSelector).findComponent({
      name: 'UserOrgSelector',
    });
    expect(selector.props('allowSelectOrg')).toBe(false);
    expect(selector.props('allowSelectUser')).toBe(true);
    expect(selector.props('orgTypes')).toEqual(['总部']);
    expect(selector.props('userApiModuleBase')).toBe('/com.example/V1/api');
    expect(selector.props('userTypes')).toEqual(['员工']);
  });
  it('未配置选择限制时显式保留组织和用户双选默认值', () => {
    const selector = mount(GlobalOrgSelector).findComponent({
      name: 'UserOrgSelector',
    });
    expect(selector.props('allowSelectOrg')).toBe(true);
    expect(selector.props('allowSelectUser')).toBe(true);
    expect(selector.props('mode')).toBe('both');
  });
  it('只在多选时应用服务端最大选择数量', () => {
    state.runtime.valueContent = { maxSelectCount: 3, multiple: true };
    expect(
      mount(GlobalOrgSelector)
        .findComponent({ name: 'UserOrgSelector' })
        .props('maxSelectCount'),
    ).toBe(3);

    state.runtime.valueContent = { maxSelectCount: 3, multiple: false };
    expect(
      mount(GlobalOrgSelector)
        .findComponent({ name: 'UserOrgSelector' })
        .props('maxSelectCount'),
    ).toBe(1);
  });
});
