import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  runtime: { enabled: true, valueContent: {} as Record<string, any> },
  selected: undefined as any,
  user: {} as Record<string, any>,
}));
const setCurrentGlobalUserOrgRecord = vi.hoisted(() => vi.fn());

vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: state.user }),
}));
vi.mock('../../shared/user-org-selector.vue', () => ({
  default: defineComponent({
    name: 'UserOrgSelector',
    props: [
      'allowClear',
      'allowSelectOrg',
      'allowSelectUser',
      'orgTypes',
      'userTypes',
    ],
    emits: ['loaded', 'update:selected-records'],
    setup(_props, { attrs }) {
      return () => h('div', { ...attrs, 'data-testid': 'selector' });
    },
  }),
}));
vi.mock('../global-org-context-state', () => ({
  currentGlobalUserOrgRecord: {
    get value() {
      return state.selected;
    },
  },
  setCurrentGlobalUserOrgRecord,
}));
vi.mock('../global-org-selector-runtime', () => ({
  globalOrgSelectorRuntimeState: state.runtime,
}));

import GlobalOrgSelector from '../global-org-selector.vue';

const records = [
  { id: 'org-1', kind: 'org', orgId: 'org-1' },
  { id: 'org-2', kind: 'org', orgId: 'org-2' },
];

describe('global org selector policy', () => {
  beforeEach(() => {
    state.runtime.valueContent = {};
    state.selected = undefined;
    state.user = {};
    setCurrentGlobalUserOrgRecord.mockReset();
  });
  it('auto-selects and hides a normal user single candidate', async () => {
    const wrapper = mount(GlobalOrgSelector);
    await wrapper
      .findComponent({ name: 'UserOrgSelector' })
      .vm.$emit('loaded', [records[0]]);
    expect(setCurrentGlobalUserOrgRecord).toHaveBeenCalledWith(records[0]);
    expect(
      wrapper.get('[data-testid="global-user-org-selector"]').classes(),
    ).toContain('hidden');
  });
  it('defaults normal user multiple candidates and forbids clear', async () => {
    const wrapper = mount(GlobalOrgSelector);
    await wrapper
      .findComponent({ name: 'UserOrgSelector' })
      .vm.$emit('loaded', records);
    expect(setCurrentGlobalUserOrgRecord).toHaveBeenCalledWith(records[0]);
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
    expect(setCurrentGlobalUserOrgRecord).toHaveBeenCalledWith(undefined);
  });
  it('forwards server candidate restrictions without widening them', () => {
    state.runtime.valueContent = {
      allowSelectOrg: false,
      allowSelectUser: true,
      orgTypes: ['总部'],
      userTypes: ['员工'],
    };
    const selector = mount(GlobalOrgSelector).findComponent({
      name: 'UserOrgSelector',
    });
    expect(selector.props('allowSelectOrg')).toBe(false);
    expect(selector.props('allowSelectUser')).toBe(true);
    expect(selector.props('orgTypes')).toEqual(['总部']);
    expect(selector.props('userTypes')).toEqual(['员工']);
  });
});
