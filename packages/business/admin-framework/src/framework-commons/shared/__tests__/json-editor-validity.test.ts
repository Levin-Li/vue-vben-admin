import { mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import JsonEditorField from '../json-editor-field.vue';

vi.mock('json-editor-vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      props: { onChange: { type: Function, default: undefined } },
      setup(props) {
        return () =>
          h('div', [
            h(
              'button',
              {
                class: 'invalid',
                onClick: () => props.onChange?.({ text: '{' }),
              },
              '无效',
            ),
            h(
              'button',
              {
                class: 'valid',
                onClick: () => props.onChange?.({ text: '{"a":2}' }),
              },
              '有效',
            ),
            h(
              'button',
              {
                class: 'null',
                onClick: () => props.onChange?.({ text: 'null' }),
              },
              '清空',
            ),
          ]);
      },
    }),
  };
});

describe('默认JSON编辑器有效性', () => {
  it('无效文本阻断外层保存且不回传旧值，合法内容立即传播', async () => {
    const wrapper = mount(JsonEditorField, {
      props: { inline: true, modelValue: { a: 1 } },
    });
    await wrapper.find('button.invalid').trigger('click');
    expect(wrapper.emitted('validity')?.at(-1)).toEqual([false]);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await wrapper.find('button.valid').trigger('click');
    expect(wrapper.emitted('validity')?.at(-1)).toEqual([true]);
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ a: 2 }]);
    await wrapper.find('button.null').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null]);
  });
});
