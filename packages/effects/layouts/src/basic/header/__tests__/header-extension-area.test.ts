import { computed, defineComponent, h, nextTick } from 'vue';

import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vben/hooks', () => ({
  useRefresh: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('@vben/icons', () => ({
  RotateCw: defineComponent({
    name: 'RotateCw',
    setup: () => () => h('span'),
  }),
}));

vi.mock('@vben/preferences', () => ({
  preferences: {
    header: {
      menuAlign: 'start',
    },
    widget: {
      fullscreen: false,
      globalSearch: false,
      languageToggle: false,
      notification: false,
      refresh: false,
      themeToggle: false,
      timezone: false,
    },
  },
  usePreferences: () => ({
    globalSearchShortcutKey: computed(() => false),
    preferencesButtonPosition: computed(() => ({
      fixed: false,
      header: false,
    })),
  }),
}));

vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({
    accessMenus: [],
  }),
}));

vi.mock('@vben-core/shadcn-ui', () => ({
  VbenFullScreen: defineComponent({
    name: 'VbenFullScreen',
    setup: () => () => h('span'),
  }),
  VbenIconButton: defineComponent({
    name: 'VbenIconButton',
    setup: (_props, { slots }) => () => h('button', slots.default?.()),
  }),
}));

vi.mock('../../../widgets', () => {
  const Stub = (name: string) =>
    defineComponent({
      name,
      setup: () => () => h('span'),
    });

  return {
    GlobalSearch: Stub('GlobalSearch'),
    LanguageToggle: Stub('LanguageToggle'),
    PreferencesButton: Stub('PreferencesButton'),
    ThemeToggle: Stub('ThemeToggle'),
    TimezoneButton: Stub('TimezoneButton'),
  };
});

import {
  addLayoutHeaderExtensionAreaItem,
  clearLayoutHeaderExtensionArea,
  removeLayoutHeaderExtensionAreaItem,
  useLayoutHeaderExtensionArea,
} from '../header-extension-area';
import LayoutHeader from '../header.vue';

describe('layout header extension area', () => {
  beforeEach(() => {
    clearLayoutHeaderExtensionArea('center');
    clearLayoutHeaderExtensionArea('right');
  });

  it('renders documented header slots in the expected order', () => {
    const wrapper = mount(LayoutHeader, {
      slots: {
        breadcrumb: '<span data-testid="breadcrumb">breadcrumb</span>',
        'header-left-10': '<span data-testid="left-before">left-before</span>',
        'header-left-60': '<span data-testid="left-after">left-after</span>',
        'header-right-10': '<span data-testid="right-before">right-before</span>',
        'header-right-160': '<span data-testid="right-after">right-after</span>',
        'header-top-center': '<span data-testid="top-center">top-center</span>',
        'header-top-right': '<span data-testid="top-right">top-right</span>',
        'user-dropdown': '<span data-testid="user-dropdown">user</span>',
      },
    });

    expect(wrapper.find('[data-testid="top-center"]').text()).toBe(
      'top-center',
    );
    expect(wrapper.find('[data-testid="top-right"]').text()).toBe('top-right');

    const text = wrapper.text();
    expect(text.indexOf('left-before')).toBeLessThan(
      text.indexOf('breadcrumb'),
    );
    expect(text.indexOf('breadcrumb')).toBeLessThan(text.indexOf('left-after'));
    expect(text.indexOf('right-before')).toBeLessThan(text.indexOf('user'));
    expect(text.indexOf('user')).toBeLessThan(text.indexOf('right-after'));
  });

  it('renders dynamic center and right header content and disposes them', async () => {
    const wrapper = mount(LayoutHeader, {
      slots: {
        menu: '<div data-testid="header-menu">menu</div>',
      },
    });

    expect(wrapper.find('[data-testid="header-center-a"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="header-right-a"]').exists()).toBe(false);

    const disposeCenter = addLayoutHeaderExtensionAreaItem('center', {
      order: 20,
      render: () => h('div', { 'data-testid': 'header-center-b' }, 'center-b'),
    });
    addLayoutHeaderExtensionAreaItem('center', {
      id: 'center-a',
      order: 10,
      render: () => h('div', { 'data-testid': 'header-center-a' }, 'center-a'),
    });
    const disposeRight = addLayoutHeaderExtensionAreaItem('right', {
      render: () => h('div', { 'data-testid': 'header-right-a' }, 'right-a'),
    });

    await nextTick();

    expect(wrapper.find('[data-testid="header-center-a"]').text()).toBe(
      'center-a',
    );
    expect(wrapper.find('[data-testid="header-center-b"]').text()).toBe(
      'center-b',
    );
    expect(wrapper.find('[data-testid="header-right-a"]').text()).toBe(
      'right-a',
    );
    expect(wrapper.text().indexOf('center-a')).toBeLessThan(
      wrapper.text().indexOf('center-b'),
    );

    disposeCenter();
    disposeRight();
    removeLayoutHeaderExtensionAreaItem('center', 'center-a');
    await nextTick();

    expect(wrapper.find('[data-testid="header-center-a"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="header-center-b"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="header-right-a"]').exists()).toBe(false);
  });

  it('registers center and right content through useLayoutHeaderExtensionArea', async () => {
    const HeaderExtensionRegistrar = defineComponent({
      name: 'HeaderExtensionRegistrar',
      setup: () => {
        const topCenter = useLayoutHeaderExtensionArea('center');
        const topRight = useLayoutHeaderExtensionArea('right');

        topCenter.add({
          id: 'use-center',
          render: () =>
            h('div', { 'data-testid': 'use-header-center' }, 'use-center'),
        });
        topRight.add({
          id: 'use-right',
          render: () =>
            h('div', { 'data-testid': 'use-header-right' }, 'use-right'),
        });

        return () => null;
      },
    });
    const wrapper = mount({
      components: { HeaderExtensionRegistrar, LayoutHeader },
      template: `
        <div>
          <HeaderExtensionRegistrar />
          <LayoutHeader />
        </div>
      `,
    });

    await nextTick();

    expect(wrapper.find('[data-testid="use-header-center"]').text()).toBe(
      'use-center',
    );
    expect(wrapper.find('[data-testid="use-header-right"]').text()).toBe(
      'use-right',
    );

    wrapper.unmount();

    const emptyWrapper = mount(LayoutHeader);
    await nextTick();

    expect(emptyWrapper.find('[data-testid="use-header-center"]').exists()).toBe(
      false,
    );
    expect(emptyWrapper.find('[data-testid="use-header-right"]').exists()).toBe(
      false,
    );
  });

  it('replaces an existing item with the same id', async () => {
    const wrapper = mount(LayoutHeader);

    addLayoutHeaderExtensionAreaItem('right', {
      id: 'same-id',
      render: () => h('div', { 'data-testid': 'header-right-old' }, 'old'),
    });
    addLayoutHeaderExtensionAreaItem('right', {
      id: 'same-id',
      render: () => h('div', { 'data-testid': 'header-right-new' }, 'new'),
    });

    await nextTick();

    expect(wrapper.find('[data-testid="header-right-old"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="header-right-new"]').text()).toBe('new');
  });
});
