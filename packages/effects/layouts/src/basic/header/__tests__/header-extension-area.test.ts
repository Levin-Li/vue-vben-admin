import { readFileSync } from 'node:fs';

import { mount } from '@vue/test-utils';
import { computed, defineComponent, h, nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addLayoutHeaderExtensionAreaItem,
  clearLayoutHeaderExtensionArea,
  removeLayoutHeaderExtensionAreaItem,
  useLayoutHeaderExtensionArea,
} from '../header-extension-area';
import LayoutHeader from '../header.vue';

const layoutPreferences = vi.hoisted(() => ({
  preferencesButtonPosition: {
    fixed: false,
    header: false,
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
}));

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
    widget: layoutPreferences.widget,
  },
  usePreferences: () => ({
    globalSearchShortcutKey: computed(() => false),
    preferencesButtonPosition: computed(
      () => layoutPreferences.preferencesButtonPosition,
    ),
  }),
}));

vi.mock('@vben/locales', () => ({
  $t: (key: string) => key,
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
    setup:
      (_props, { slots }) =>
      () =>
        h('button', slots.default?.()),
  }),
  VbenTooltip: defineComponent({
    name: 'VbenTooltip',
    setup:
      (_props, { slots }) =>
      () =>
        h('div', { class: 'tooltip-stub' }, slots.trigger?.()),
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

describe('layout header extension area', () => {
  beforeEach(() => {
    clearLayoutHeaderExtensionArea('center');
    clearLayoutHeaderExtensionArea('right');
    Object.assign(layoutPreferences.preferencesButtonPosition, {
      fixed: false,
      header: false,
    });
    Object.assign(layoutPreferences.widget, {
      fullscreen: false,
      globalSearch: false,
      languageToggle: false,
      notification: false,
      refresh: false,
      themeToggle: false,
      timezone: false,
    });
  });

  it('groups enabled interface utilities into a compact vertical action list', () => {
    Object.assign(layoutPreferences.preferencesButtonPosition, {
      header: true,
    });
    Object.assign(layoutPreferences.widget, {
      fullscreen: true,
      languageToggle: true,
      themeToggle: true,
      timezone: true,
    });

    const wrapper = mount(LayoutHeader);
    const quickActions = wrapper.find('[data-testid="header-quick-actions"]');

    expect(quickActions.attributes('aria-label')).toBe(
      'ui.widgets.quickActions',
    );
    expect(quickActions.findAll('.header-quick-actions__item')).toHaveLength(5);
    expect(
      quickActions.findComponent({ name: 'PreferencesButton' }).exists(),
    ).toBe(true);
    expect(quickActions.findComponent({ name: 'ThemeToggle' }).exists()).toBe(
      true,
    );
    expect(
      quickActions.findComponent({ name: 'LanguageToggle' }).exists(),
    ).toBe(true);
    expect(
      quickActions.findComponent({ name: 'TimezoneButton' }).exists(),
    ).toBe(true);
    expect(
      quickActions.findComponent({ name: 'VbenFullScreen' }).exists(),
    ).toBe(true);
  });

  it('keeps the header wrapper open for the expanded quick-action overlay', () => {
    const source = readFileSync(
      'packages/@core/ui-kit/layout-ui/src/vben-layout.vue',
      'utf8',
    );

    expect(source).toContain(
      'class="overflow-visible transition-all duration-200"',
    );
  });

  it('does not clip the quick-action overlay when the header has rounded corners', () => {
    const source = readFileSync(
      'packages/@core/ui-kit/layout-ui/src/components/layout-header.vue',
      'utf8',
    );

    expect(source).not.toContain("{ overflow: 'hidden' }");
  });

  it('uses theme tokens for controls when a custom header color is active', () => {
    const layoutHeaderSource = readFileSync(
      'packages/@core/ui-kit/layout-ui/src/components/layout-header.vue',
      'utf8',
    );
    const globalSearchSource = readFileSync(
      'packages/effects/layouts/src/widgets/global-search/global-search.vue',
      'utf8',
    );
    const layoutSource = readFileSync(
      'packages/@core/ui-kit/layout-ui/src/vben-layout.vue',
      'utf8',
    );
    const userDropdownSource = readFileSync(
      'packages/effects/layouts/src/widgets/user-dropdown/user-dropdown.vue',
      'utf8',
    );

    expect(layoutHeaderSource).toContain(
      "'--header-control-background': 'transparent'",
    );
    expect(layoutHeaderSource).toContain(
      "'hsl(var(--header-menu-theme-color, var(--primary)))'",
    );
    expect(layoutHeaderSource).toContain(
      "'--header-control-foreground': 'hsl(var(--primary-foreground))'",
    );
    expect(layoutHeaderSource).toContain(
      "'hsl(var(--header-menu-background, var(--header)))'",
    );
    expect(globalSearchSource).toContain('header-global-search');
    expect(globalSearchSource).toContain('--header-control-background');
    expect(layoutSource).toContain('header-theme-control');
    expect(userDropdownSource).toContain('header-user-dropdown');
    expect(userDropdownSource).toContain("[data-state='open']");
    expect(userDropdownSource).toContain('--header-menu-background');
  });

  it('separates the topbar interaction theme from popup menu backgrounds', () => {
    const basicLayoutSource = readFileSync(
      'packages/effects/layouts/src/basic/layout.vue',
      'utf8',
    );
    const notificationSource = readFileSync(
      'packages/effects/layouts/src/widgets/notification/notification.vue',
      'utf8',
    );

    expect(basicLayoutSource).toContain('const headerMenuPopupStyle');
    expect(basicLayoutSource).toContain('--header-menu-background');
    expect(basicLayoutSource).toContain(
      "'--menu-submenu-active-background-color':",
    );
    expect(basicLayoutSource).toContain('--header-menu-theme-color');
    expect(notificationSource).toContain('--header-menu-background');

    const preferencesSource = readFileSync(
      'packages/@core/preferences/src/update-css-variables.ts',
      'utf8',
    );
    expect(preferencesSource).toContain('headerMenuBackgroundColorCustom');
    expect(preferencesSource).toContain('sidebarMenuBackgroundColorCustom');
  });

  it('uses the dark theme base background without changing saved preferences', () => {
    const source = readFileSync(
      'packages/effects/layouts/src/basic/layout.vue',
      'utf8',
    );
    const baseBackgroundSection = source.slice(
      source.indexOf('const baseBackgroundColor'),
      source.indexOf('const baseLayoutStyle'),
    );

    expect(baseBackgroundSection).toContain('if (isDark.value)');
    expect(baseBackgroundSection).toContain(
      "return 'hsl(var(--background-deep))';",
    );
    expect(baseBackgroundSection).toContain(
      'preferences.theme.baseBackgroundColorCustom',
    );
    expect(baseBackgroundSection).not.toContain('updatePreferences');
  });

  it('renders documented header slots in the expected order', () => {
    const wrapper = mount(LayoutHeader, {
      slots: {
        breadcrumb: '<span data-testid="breadcrumb">breadcrumb</span>',
        'header-left-10': '<span data-testid="left-before">left-before</span>',
        'header-left-60': '<span data-testid="left-after">left-after</span>',
        'header-right-10':
          '<span data-testid="right-before">right-before</span>',
        'header-right-160':
          '<span data-testid="right-after">right-after</span>',
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

  it('scrolls the constrained center extension area instead of shrinking its content', () => {
    const wrapper = mount(LayoutHeader, {
      slots: {
        'header-top-center': '<span>top-center</span>',
      },
    });

    expect(
      wrapper.get('[data-testid="header-top-center-extensions"]').classes(),
    ).toContain('overflow-x-auto');
  });

  it('renders dynamic center and right header content and disposes them', async () => {
    const wrapper = mount(LayoutHeader, {
      slots: {
        menu: '<div data-testid="header-menu">menu</div>',
      },
    });

    expect(wrapper.find('[data-testid="header-center-a"]').exists()).toBe(
      false,
    );
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

    expect(wrapper.find('[data-testid="header-center-a"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="header-center-b"]').exists()).toBe(
      false,
    );
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

    expect(
      emptyWrapper.find('[data-testid="use-header-center"]').exists(),
    ).toBe(false);
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
