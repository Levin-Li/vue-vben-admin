import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import GlobalOrgSelector from '../global-org-selector.vue';

vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({
    userInfo: { admin: true },
  }),
}));

vi.mock('ant-design-vue', () => ({
  Drawer: defineComponent({
    name: 'MobileDrawerStub',
    props: {
      open: Boolean,
      height: String,
      rootStyle: Object,
      bodyStyle: Object,
    },
    setup(props, { attrs, slots }) {
      return () => (props.open ? h('div', attrs, slots.default?.()) : null);
    },
  }),
}));

vi.mock('../../shared/user-org-selector.vue', () => ({
  default: defineComponent({
    name: 'UserOrgSelector',
    props: { inline: Boolean },
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
  it('offers a mobile trigger that opens a usable selector panel', async () => {
    const wrapper = mount(GlobalOrgSelector, {
      props: { mobileOnly: true },
      global: {
        stubs: {
          IconifyIcon: true,
        },
      },
    });
    const trigger = wrapper.find(
      '[data-testid="mobile-global-user-org-trigger"]',
    );
    expect(trigger.exists()).toBe(true);
    await trigger.trigger('click');
    expect(
      wrapper.find('[data-testid="mobile-global-user-org-drawer"]').exists(),
    ).toBe(true);
    expect(wrapper.findAllComponents({ name: 'UserOrgSelector' })).toHaveLength(
      1,
    );
    expect(
      wrapper.findComponent({ name: 'UserOrgSelector' }).props('inline'),
    ).toBe(true);
  });

  it('keeps a 220px minimum width', () => {
    const wrapper = mount(GlobalOrgSelector);

    expect(
      wrapper.get('[data-testid="global-user-org-selector"]').classes(),
    ).toContain('min-w-[220px]');
  });

  it('键盘缩短可视视口时收缩抽屉并抬离键盘', async () => {
    vi.stubGlobal('innerHeight', 800);
    let resizeViewport: (() => void) | undefined;
    const visualViewport = {
      height: 800,
      offsetTop: 0,
      addEventListener: vi.fn((event, listener) => {
        if (event === 'resize') resizeViewport = listener;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('visualViewport', visualViewport);

    const wrapper = mount(GlobalOrgSelector, { props: { mobileOnly: true } });
    try {
      await wrapper
        .get('[data-testid="mobile-global-user-org-trigger"]')
        .trigger('click');
      const drawer = wrapper.findComponent({ name: 'MobileDrawerStub' });
      expect(drawer.props('height')).toBe('600px');

      visualViewport.height = 500;
      resizeViewport?.();
      await wrapper.vm.$nextTick();
      expect(drawer.props('height')).toBe('488px');
      expect(drawer.props('rootStyle')).toMatchObject({ bottom: '300px' });
    } finally {
      wrapper.unmount();
      vi.unstubAllGlobals();
    }
  });
});
