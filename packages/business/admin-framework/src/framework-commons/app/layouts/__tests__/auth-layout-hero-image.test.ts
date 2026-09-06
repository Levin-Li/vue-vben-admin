import { flushPromises, mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import AuthLayout from '../auth.vue';

const mocks = vi.hoisted(() => ({
  heroImageCandidates: undefined as any,
  loadAuthBrand: vi.fn().mockResolvedValue(undefined),
  techSupport: undefined as any,
}));

mocks.heroImageCandidates = ref<string[]>([]);
mocks.techSupport = ref('租户技术支持');

vi.mock('@vben/layouts', () => ({
  AuthenticationColorToggle: { template: '<div />' },
  AuthenticationLayoutToggle: { template: '<div />' },
  LanguageToggle: { template: '<div />' },
  ThemeToggle: { template: '<div />' },
}));

vi.mock('@vben/preferences', () => ({
  preferences: {
    logo: {
      source: '/logo.svg',
    },
    widget: {},
  },
  usePreferences: () => ({
    authPanelCenter: ref(false),
    isDark: ref(false),
  }),
}));

vi.mock(
  '@levin/admin-framework/framework-commons/app/views/_core/authentication/auth-brand',
  () => ({
    useAuthBrand: () => ({
      appName: ref('租户门户'),
      copyright: ref('Copyright'),
      heroImageCandidates: mocks.heroImageCandidates,
      loadAuthBrand: mocks.loadAuthBrand,
      logoCandidates: ref(['/logo.svg']),
      techSupport: mocks.techSupport,
      titleImageCandidates: ref([]),
    }),
  }),
);

describe('authentication layout login hero image', () => {
  it('shows copyright before technical support and allows the footer to wrap', () => {
    const wrapper = mount(AuthLayout, {
      global: {
        stubs: {
          RouterView: true,
        },
      },
    });

    const footer = wrapper.get('.auth-copyright');
    expect(footer.text()).toBe('Copyright·租户技术支持');
    expect(footer.classes()).toContain('flex-wrap');
    expect(wrapper.get('main').text()).not.toContain('租户技术支持');
    expect(wrapper.text().match(/租户技术支持/g)).toHaveLength(1);
    wrapper.unmount();
  });

  it('uses the built-in illustration when the configured image is missing or fails', async () => {
    const wrapper = mount(AuthLayout, {
      global: {
        stubs: {
          RouterView: true,
        },
      },
    });

    await flushPromises();
    expect(wrapper.find('.auth-flow-art svg').exists()).toBe(true);

    mocks.heroImageCandidates.value = ['/tenant-login-hero.png'];
    await nextTick();
    expect(wrapper.find('.auth-flow-art img').attributes('src')).toBe(
      '/tenant-login-hero.png',
    );

    await wrapper.find('.auth-flow-art img').trigger('error');
    await nextTick();
    expect(wrapper.find('.auth-flow-art svg').exists()).toBe(true);

    mocks.heroImageCandidates.value = [
      '/ui-setting-hero.png',
      '/tenant-site-hero.png',
    ];
    await nextTick();
    await wrapper.find('.auth-flow-art img').trigger('error');
    await nextTick();
    expect(wrapper.find('.auth-flow-art img').attributes('src')).toBe(
      '/tenant-site-hero.png',
    );
  });
});
