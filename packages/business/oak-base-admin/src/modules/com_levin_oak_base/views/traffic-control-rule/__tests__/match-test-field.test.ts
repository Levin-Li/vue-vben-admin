import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import MatchTestField from '../match-test-field.vue';

vi.mock('@levin/admin-framework', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    PatternListEditor: {
      emits: ['dropdownVisibleChange', 'search', 'test', 'update:modelValue'],
      name: 'PatternListEditor',
      props: [
        'customTest',
        'loading',
        'matchMode',
        'modelValue',
        'options',
        'placeholder',
        'testable',
        'testPlaceholder',
        'validateItem',
      ],
      template:
        '<button data-test="pattern-list-editor" @click="$emit(\'update:modelValue\', [\'/demo/*\'])"></button><button data-test="pattern-list-test" @click="$emit(\'test\')"></button>',
    },
  };
});

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

  it('uses the shared pattern list editor with custom testing for name value rules', async () => {
    const wrapper = mount(MatchTestField, {
      attachTo: document.body,
      props: {
        field: {
          key: 'headerRuleList',
          label: '请求头匹配列表',
        },
        modelValue: ['X-*=vip?'],
        ruleKind: 'nameValue',
      },
    });

    const editor = wrapper.findComponent({ name: 'PatternListEditor' });
    expect(editor.exists()).toBe(true);
    expect(editor.props('testable')).toBe(true);
    expect(editor.props('customTest')).toBe(true);
    expect(editor.props('validateItem')).toEqual(expect.any(Function));

    await wrapper.find('[data-test="pattern-list-editor"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      ['/demo/*'],
    ]);

    await wrapper.find('[data-test="pattern-list-test"]').trigger('click');
    await flushPromises();

    expect(document.body.textContent).toContain('请求头匹配列表 - 测试匹配');
    wrapper.unmount();
  });
});
