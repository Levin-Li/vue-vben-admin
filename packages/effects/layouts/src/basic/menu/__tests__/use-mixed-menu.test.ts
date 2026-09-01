import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { useMixedMenu } from '../use-mixed-menu';

const testState = vi.hoisted(() => ({
  navigation: vi.fn(),
  route: {
    meta: {},
    path: '/current-page',
  },
}));

vi.mock('@vben/preferences', () => ({
  preferences: {
    app: { layout: 'side-nav' },
    navigation: { split: false },
    sidebar: { enable: true },
  },
  usePreferences: () => ({
    isHeaderMixedNav: { value: false },
    isMixedNav: { value: false },
  }),
}));

vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({
    accessMenus: [],
  }),
}));

vi.mock('@vben/utils', () => ({
  findRootMenuByPath: () => ({}),
}));

vi.mock('vue-router', () => ({
  useRoute: () => testState.route,
}));

vi.mock('../use-navigation', () => ({
  useNavigation: () => ({
    navigation: testState.navigation,
    willOpenedByWindow: () => false,
  }),
}));

describe('mixed menu', () => {
  it('does not navigate when a group is opened', () => {
    const wrapper = mount(
      defineComponent({
        setup() {
          const menu = useMixedMenu();
          return () =>
            h('button', {
              onClick: () => menu.handleMenuOpen('/group', []),
            });
        },
      }),
    );

    wrapper.get('button').trigger('click');

    expect(testState.navigation).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
