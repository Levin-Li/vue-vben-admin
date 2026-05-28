import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import JsonEditorField from '../json-editor-field.vue';

vi.mock('json-editor-vue', () => ({
  default: defineComponent({
    name: 'JsonEditorVue',
    setup() {
      return () => h('div', { 'data-test': 'json-editor' });
    },
  }),
}));

describe('json editor field', () => {
  it('uses a readonly input as the only popup edit entry', async () => {
    const wrapper = mount(JsonEditorField, {
      props: {
        modelValue: { enabled: true },
        title: '扩展信息',
      },
    });

    const input = wrapper.get('input');

    expect(input.attributes('readonly')).toBeDefined();
    expect(input.element.value).toBe('{"enabled":true}');
    expect(wrapper.find('button').exists()).toBe(false);
    expect(document.body.textContent).not.toContain('编辑扩展信息');

    await input.trigger('click');

    expect(document.body.textContent).toContain('编辑扩展信息');

    wrapper.unmount();
  });
});
