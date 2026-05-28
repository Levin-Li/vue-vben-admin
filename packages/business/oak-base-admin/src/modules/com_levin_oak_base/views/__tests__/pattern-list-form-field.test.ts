import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import PatternListFormField from '../pattern-list-form-field.vue';

vi.mock('@levin/admin-framework', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
      PatternListEditor: {
        emits: ['dropdownVisibleChange', 'search', 'update:modelValue'],
        name: 'PatternListEditor',
      props: ['hint', 'modelValue', 'placeholder', 'showEmptyImage'],
      template: '<div data-test="pattern-list-editor"></div>',
    },
  };
});

describe('pattern list form field', () => {
  it('suppresses the default wildcard hint when the field already has help', () => {
    const wrapper = mount(PatternListFormField, {
      props: {
        field: {
          help: '业务字段已有说明。',
          key: 'methodList',
          label: '请求方法包含列表',
        } as any,
        modelValue: [],
      },
    });

    expect(
      wrapper.findComponent({ name: 'PatternListEditor' }).props('hint'),
    ).toBe('');
  });

  it('uses the editor default hint when the field has no help', () => {
    const wrapper = mount(PatternListFormField, {
      props: {
        field: {
          key: 'methodList',
          label: '请求方法包含列表',
        } as any,
        modelValue: [],
      },
    });

    expect(
      wrapper.findComponent({ name: 'PatternListEditor' }).props('hint'),
    ).toBeUndefined();
  });

  it('passes through explicit empty image display config', () => {
    const wrapper = mount(PatternListFormField, {
      props: {
        field: {
          key: 'methodList',
          label: '请求方法包含列表',
          showEmptyImage: true,
        } as any,
        modelValue: [],
      },
    });

    expect(
      wrapper
        .findComponent({ name: 'PatternListEditor' })
        .props('showEmptyImage'),
    ).toBe(true);
  });
});
