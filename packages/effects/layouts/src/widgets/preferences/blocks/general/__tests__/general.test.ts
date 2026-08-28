import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import General from '../general.vue';

vi.mock('@vben/locales', () => ({
  $t: (key: string) => key,
}));

const ItemStub = defineComponent({
  name: 'ItemStub',
  setup(_, { slots }) {
    return () => h('div', slots.default?.());
  },
});

const SwitchItemStub = defineComponent({
  emits: ['update:modelValue'],
  name: 'SwitchItem',
  props: {
    modelValue: Boolean,
  },
  setup(_, { slots }) {
    return () =>
      h('div', [
        slots.default?.(),
        slots['before-switch']?.(),
        slots.shortcut?.(),
      ]);
  },
});

describe('PreferenceGeneralConfig', () => {
  it('opens the shared color settings dialog for an enabled custom watermark', async () => {
    const wrapper = mount(General, {
      global: {
        stubs: {
          InputItem: ItemStub,
          SelectItem: ItemStub,
          SwitchItem: SwitchItemStub,
        },
      },
      props: {
        appWatermark: true,
        appWatermarkColor: 'gray',
        appWatermarkColorCustom: false,
      },
    });

    expect(wrapper.text()).toContain('preferences.watermarkColor');
    expect(wrapper.find('input[type="color"]').exists()).toBe(false);
    expect(wrapper.find('button').attributes('disabled')).toBeDefined();

    await wrapper.setProps({ appWatermarkColorCustom: true });
    await nextTick();
    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('openColorSettings')).toEqual([['watermark']]);
  });
});
