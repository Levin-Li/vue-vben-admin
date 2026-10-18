import { flushPromises, mount } from '@vue/test-utils';

import { Input, InputNumber, Select } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import CrudDefaultValueEditor from '../crud-default-value-editor.vue';

describe('页面展示设置默认值编辑器', () => {
  it('类型未知时使用字符串输入框，明确数值时才使用数字框', async () => {
    const wrapper = mount(CrudDefaultValueEditor, { props: { value: 12 } });
    expect(wrapper.findComponent(Input).exists()).toBe(true);
    expect(wrapper.findComponent(InputNumber).exists()).toBe(false);
    expect(wrapper.findComponent(Input).props('value')).toBe('12');
    expect(wrapper.emitted('update:value')).toBeUndefined();

    wrapper.findComponent(Input).vm.$emit('update:value', 'abc-12');
    expect(wrapper.emitted('update:value')?.[0]).toEqual(['abc-12']);
    await wrapper.setProps({
      field: { key: 'count', label: '数量', type: 'number' },
    });
    expect(wrapper.findComponent(InputNumber).exists()).toBe(true);
    wrapper.findComponent(InputNumber).vm.$emit('update:value', 3);
    expect(wrapper.emitted('update:value')?.[1]).toEqual([3]);
    wrapper.unmount();
  });

  it('固定选项与异步枚举保留选项原值类型，未匹配历史值不被改写', async () => {
    const loadOptions = Object.assign(
      vi.fn().mockResolvedValue([
        { label: '待处理', value: 'PENDING', ordinal: 1 },
        { label: '已完成', value: 'DONE', ordinal: 2 },
      ]),
      { optionSource: 'enum' as const },
    );
    const wrapper = mount(CrudDefaultValueEditor, {
      props: {
        field: {
          key: 'status',
          label: '状态',
          loadOptions,
          valueType: 'number',
        },
        value: 9,
      },
    });
    await flushPromises();
    const select = wrapper.findComponent(Select);
    expect(loadOptions).toHaveBeenCalledOnce();
    expect(select.props('options')).toEqual([
      { label: '当前值：9', value: '0' },
      { label: '待处理', value: '1', ordinal: 1 },
      { label: '已完成', value: '2', ordinal: 2 },
    ]);
    expect(wrapper.emitted('update:value')).toBeUndefined();
    select.vm.$emit('update:value', '2');
    expect(wrapper.emitted('update:value')?.[0]).toEqual([2]);

    await wrapper.setProps({
      field: {
        key: 'category',
        label: '类别',
        options: [{ label: '常规', value: 'GENERAL' }],
      },
      value: 'GENERAL',
    });
    expect(wrapper.findComponent(Select).props('value')).toBe('0');
    expect(wrapper.findComponent(Select).props('options')).toEqual([
      { label: '常规', value: '0' },
    ]);

    const loadDictionary = Object.assign(
      vi.fn().mockResolvedValue([{ label: '重点', value: 'IMPORTANT' }]),
      { optionSource: 'dictionary' as const },
    );
    await wrapper.setProps({
      field: { key: 'category', label: '类别', loadOptions: loadDictionary },
      value: 'IMPORTANT',
    });
    await flushPromises();
    expect(wrapper.findComponent(Select).props('options')).toEqual([
      { label: '重点', value: '0' },
    ]);
    wrapper.findComponent(Select).vm.$emit('update:value', '0');
    expect(wrapper.emitted('update:value')?.[1]).toEqual(['IMPORTANT']);
    wrapper.unmount();
  });

  it('字典选项加载失败时保留已有值', async () => {
    const loadOptions = Object.assign(
      vi.fn().mockRejectedValue(new Error('暂不可用')),
      { optionSource: 'dictionary' as const },
    );
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wrapper = mount(CrudDefaultValueEditor, {
      props: {
        field: { key: 'category', label: '类别', loadOptions },
        value: 'OLD',
      },
    });
    await flushPromises();
    expect(wrapper.findComponent(Select).props('options')).toEqual([
      { label: '当前值：OLD', value: '0' },
    ]);
    expect(wrapper.emitted('update:value')).toBeUndefined();
    expect(warning).toHaveBeenCalledOnce();
    wrapper.unmount();
    warning.mockRestore();
  });
});
