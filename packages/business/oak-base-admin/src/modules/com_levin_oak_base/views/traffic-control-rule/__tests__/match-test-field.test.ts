import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import MatchTestField from '../match-test-field.vue';

vi.mock('@levin/admin-framework', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    PatternListEditor: {
      emits: ['dropdownVisibleChange', 'search', 'update:modelValue'],
      name: 'PatternListEditor',
      props: [
        'loading',
        'matchMode',
        'modelValue',
        'options',
        'placeholder',
        'testPlaceholder',
      ],
      template:
        '<button data-test="pattern-list-editor" @click="$emit(\'update:modelValue\', [\'/demo/*\'])"></button>',
    },
  };
});

vi.mock(
  '@levin/admin-framework/framework-commons/shared/json-editor-field.vue',
  () => ({
    default: {
      emits: ['update:modelValue'],
      name: 'JsonEditorField',
      props: ['modelValue'],
      template:
        "<button data-test=\"json-editor\" @click=\"$emit('update:modelValue', [{ name: 'X-*', value: 'vip?' }])\"></button>",
    },
  }),
);

describe('traffic control match test field', () => {
  it('uses the shared pattern list editor for list fields', async () => {
    const wrapper = mount(MatchTestField, {
      props: {
        field: {
          key: 'urlPathList',
          label: 'URL包含列表',
          loadOptions: vi.fn(async () => [
            { label: '订单接口', value: '/api/order/*' },
          ]),
        },
        modelValue: ['/api/*'],
      },
    });

    await flushPromises();

    const editor = wrapper.findComponent({ name: 'PatternListEditor' });
    expect(editor.exists()).toBe(true);
    expect(editor.props('options')).toEqual([
      {
        description: '',
        disabled: false,
        label: '订单接口',
        value: '/api/order/*',
      },
    ]);
    expect(editor.props('matchMode')).toBe('any');

    await wrapper.find('[data-test="pattern-list-editor"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['/demo/*']]);
  });

  it('preserves static selectable options in the shared editor', async () => {
    const wrapper = mount(MatchTestField, {
      props: {
        field: {
          key: 'limitDimensionList',
          label: '限流维度',
          options: [
            { label: '规则', value: 'Rule' },
            { label: '请求头', value: 'Header' },
          ],
        },
        modelValue: ['Rule'],
      },
    });

    const editor = wrapper.findComponent({ name: 'PatternListEditor' });
    expect(editor.exists()).toBe(true);
    expect(editor.props('options')).toEqual([
      {
        description: '',
        disabled: false,
        label: '规则',
        value: 'Rule',
      },
      {
        description: '',
        disabled: false,
        label: '请求头',
        value: 'Header',
      },
    ]);
  });

  it('passes configured match mode to the shared editor', async () => {
    const wrapper = mount(MatchTestField, {
      props: {
        field: {
          key: 'ipList',
          label: 'IP包含列表',
          matchMode: 'all',
        } as any,
        modelValue: ['10.*', '*.1'],
      },
    });

    expect(
      wrapper.findComponent({ name: 'PatternListEditor' }).props('matchMode'),
    ).toBe('all');
  });

  it('keeps name value rules on the JSON editor', async () => {
    const wrapper = mount(MatchTestField, {
      props: {
        field: {
          key: 'headerRuleList',
          label: '请求头匹配数组',
        },
        modelValue: [{ name: 'X-*', value: 'vip?' }],
        ruleKind: 'nameValue',
      },
    });

    expect(wrapper.findComponent({ name: 'JsonEditorField' }).exists()).toBe(
      true,
    );
    expect(wrapper.findComponent({ name: 'PatternListEditor' }).exists()).toBe(
      false,
    );

    await wrapper.find('[data-test="json-editor"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      [{ name: 'X-*', value: 'vip?' }],
    ]);
  });
});
