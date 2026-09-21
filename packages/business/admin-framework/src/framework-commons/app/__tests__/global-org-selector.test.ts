import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import GlobalOrgSelector from '../global-org-selector.vue';

vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({
    userInfo: { admin: true },
  }),
}));

vi.mock('../../shared/user-org-selector.vue', () => ({
  default: defineComponent({
    name: 'UserOrgSelector',
    setup(_props, { attrs }) {
      return () =>
        h('div', {
          ...attrs,
          'data-testid': 'global-user-org-selector',
        });
    },
  }),
}));

vi.mock('../global-org-context-state', () => ({
  currentGlobalUserOrgRecords: ref([]),
  setCurrentGlobalUserOrgRecords: vi.fn(),
}));

vi.mock('../global-org-selector-runtime', () => ({
  globalOrgSelectorRuntimeState: {
    enabled: true,
    valueContent: {},
  },
}));

describe('global org selector', () => {
  it('keeps a 220px minimum width', () => {
    const wrapper = mount(GlobalOrgSelector);

    expect(
      wrapper.get('[data-testid="global-user-org-selector"]').classes(),
    ).toContain('min-w-[220px]');
  });
});
