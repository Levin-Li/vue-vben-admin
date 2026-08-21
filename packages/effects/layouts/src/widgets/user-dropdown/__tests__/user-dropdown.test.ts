import { mount } from '@vue/test-utils';
import { computed, defineComponent, h, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import UserDropdown from '../user-dropdown.vue';

vi.mock('@vben/hooks', () => ({
  useHoverToggle: () => [ref(false), { disable: vi.fn(), enable: vi.fn() }],
}));

vi.mock('@vben/icons', () => ({
  LockKeyhole: defineComponent({
    name: 'LockKeyhole',
    setup: () => () => h('span'),
  }),
  LogOut: defineComponent({
    name: 'LogOut',
    setup: () => () => h('span'),
  }),
}));

vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));

vi.mock('@vben/preferences', () => ({
  preferences: {
    shortcutKeys: { enable: false },
    widget: { lockScreen: false },
  },
  usePreferences: () => ({
    globalLockScreenShortcutKey: computed(() => false),
    globalLogoutShortcutKey: computed(() => false),
  }),
}));

vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({ lockScreen: vi.fn() }),
}));

vi.mock('@vben/utils', () => ({ isWindowsOs: () => false }));

vi.mock('@vben-core/popup-ui', () => ({
  useVbenModal: () => [
    defineComponent({
      inheritAttrs: false,
      setup:
        (_props, { attrs, slots }) =>
        () =>
          h('div', attrs, slots.default?.()),
    }),
    { close: vi.fn(), open: vi.fn() },
  ],
}));

vi.mock('@vben-core/shadcn-ui', () => {
  const Stub = (name: string) =>
    defineComponent({
      name,
      setup:
        (_props, { slots }) =>
        () =>
          h('div', slots.default?.()),
    });

  return {
    Badge: Stub('Badge'),
    DropdownMenu: Stub('DropdownMenu'),
    DropdownMenuContent: Stub('DropdownMenuContent'),
    DropdownMenuItem: Stub('DropdownMenuItem'),
    DropdownMenuLabel: Stub('DropdownMenuLabel'),
    DropdownMenuSeparator: Stub('DropdownMenuSeparator'),
    DropdownMenuShortcut: Stub('DropdownMenuShortcut'),
    DropdownMenuTrigger: Stub('DropdownMenuTrigger'),
    VbenAvatar: defineComponent({
      name: 'VbenAvatar',
      props: { alt: String },
      setup: (props) => () => h('span', { 'data-avatar': props.alt }),
    }),
    VbenIcon: Stub('VbenIcon'),
  };
});

vi.mock('@vueuse/core', () => ({
  useMagicKeys: () => ({}),
  whenever: vi.fn(),
}));

vi.mock('../../lock-screen', () => ({
  LockScreenModal: defineComponent({
    name: 'LockScreenModal',
    setup: () => () => h('div'),
  }),
}));

describe('user dropdown', () => {
  it('reserves space for a three-character username in the header trigger', () => {
    const wrapper = mount(UserDropdown, {
      props: {
        text: '管理员',
      },
    });

    const name = wrapper.find('.user-dropdown-trigger__name');

    expect(name.text()).toBe('管理员');
    expect(name.classes()).toContain('min-w-[3em]');
    expect(wrapper.find('[data-avatar="管理员"]').exists()).toBe(true);
  });
});
