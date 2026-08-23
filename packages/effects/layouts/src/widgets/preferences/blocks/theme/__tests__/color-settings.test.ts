import { mount } from '@vue/test-utils';
import { TinyColor } from '@vben/utils';
import { defineComponent, h, nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import ColorSettings from '../color-settings.vue';
import PreferencesDrawer from '../../../preferences-drawer.vue';

vi.mock('@vben-core/popup-ui', () => ({
  useVbenDrawer: () => [
    defineComponent({
      name: 'TestDrawer',
      setup(_, { slots }) {
        return () => h('div', slots.default?.());
      },
    }),
  ],
  useVbenModal: () => [
    defineComponent({
      name: 'TestModal',
      setup(_, { slots }) {
        return () => h('div', slots.default?.());
      },
    }),
    { open: vi.fn() },
  ],
}));

describe('ColorSettings', () => {
  it('emits the selected footer color to its parent', async () => {
    const wrapper = mount(ColorSettings, {
      global: {
        stubs: {
          BackgroundSettings: true,
          BuiltinTheme: true,
          VbenButton: true,
        },
      },
      props: {
        footerBackgroundColor: '#f2f4f7',
        footerBackgroundTransparency: 0,
        isDark: false,
      },
    });

    wrapper.vm.open('footerBackground');
    await wrapper.find('input[type="color"]').setValue('#0bd092');

    const emitted = wrapper.emitted('update:footerBackgroundColor');
    expect(emitted).toHaveLength(1);
    expect(new TinyColor(String(emitted?.[0]?.[0])).toHexString()).toBe(
      '#0bd092',
    );
  });

  it('forwards footer color updates through the preferences drawer', async () => {
    const ColorSettingsStub = defineComponent({
      emits: ['update:footerBackgroundColor'],
      name: 'ColorSettings',
      props: {
        footerBackgroundColor: String,
      },
      setup() {
        return () => h('div');
      },
    });
    const AppearanceTabsStub = defineComponent({
      name: 'VbenSegmented',
      setup(_, { slots }) {
        return () => h('div', slots.appearance?.());
      },
    });
    const BlockStub = defineComponent({
      name: 'Block',
      setup(_, { slots }) {
        return () => h('div', slots.default?.());
      },
    });

    const wrapper = mount(PreferencesDrawer, {
      global: {
        stubs: {
          Block: BlockStub,
          ColorSettings: ColorSettingsStub,
          FontScale: true,
          FontSize: true,
          Radius: true,
          Theme: true,
          VbenSegmented: AppearanceTabsStub,
        },
      },
      props: {
        footerBackgroundColor: '#f2f4f7',
      },
    });

    const colorSettings = wrapper.findComponent(ColorSettings);
    expect(colorSettings.props('footerBackgroundColor')).toBe('#f2f4f7');

    colorSettings.vm.$emit('update:footerBackgroundColor', '#0bd092');
    await nextTick();

    expect(wrapper.emitted('update:footerBackgroundColor')).toEqual([
      ['#0bd092'],
    ]);
  });
});
