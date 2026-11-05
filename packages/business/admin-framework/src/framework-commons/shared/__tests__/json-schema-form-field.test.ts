import { readFileSync } from 'node:fs';

import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { Input, Modal, Select } from 'ant-design-vue';

import JsonSchemaFormField from '../json-schema-form-field.vue';

describe('json schema form field', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('fills the assigned grid columns without an inner 480px cap', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/shared/json-schema-form-field.vue',
      'utf8',
    );

    expect(source).toContain(':style="popupGridStyle"');
    expect(source).toContain(
      'gridTemplateColumns: `repeat(${popupColumnCount.value}, minmax(0, 1fr))`',
    );
    expect(source).not.toContain('max-width: 480px');
    expect(source).not.toContain('justify-self-center');
    expect(source).toContain('class="w-full"');
  });

  it.each([false, true])('枚举选项在弹窗和内联模式支持拼音与首字母：%s', async (inline) => {
    const wrapper = mount(JsonSchemaFormField, {
      props: { inline, modelValue: {}, schema: { type: 'object', properties: { status: { type: 'string', title: '状态', enum: ['待处理', '已完成'] } } } },
    });
    if (!inline) {
      await wrapper.find('button').trigger('click');
      await flushPromises();
    }
    const select = wrapper.findComponent(Select);
    expect(select.exists()).toBe(true);
    const filter = select.props('filterOption') as (input: string, option: { label: string; value: string }) => boolean;
    expect(filter('dcl', { label: '待处理', value: '待处理' })).toBe(true);
    expect(filter('yiwancheng', { label: '已完成', value: '已完成' })).toBe(true);
    wrapper.unmount();
  });

  it('preserves json metadata when saving from the default popup editor', async () => {
    const schema = {
      properties: {
        name: {
          title: '名称',
          type: 'string',
        },
      },
      type: 'object',
    };
    const schemaText = JSON.stringify(schema);
    const wrapper = mount(JsonSchemaFormField, {
      attachTo: document.body,
      props: {
        modelValue: {
          '@JsonSchema': schemaText,
          name: 'Alice',
        },
        schema,
        title: '扩展信息',
      },
    });

    await wrapper.find('button').trigger('click');
    await flushPromises();

    const inputs = wrapper.findAllComponents(Input);
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    await inputs.at(-1)!.vm.$emit('update:value', 'Bob');
    await flushPromises();

    wrapper.findComponent(Modal).vm.$emit('ok');
    await flushPromises();

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      '@JsonSchema': schemaText,
      name: 'Bob',
    });
  });
});

const rootArraySchema = {
  type: 'array',
  items: { type: 'object', properties: { address: { type: 'string' } } },
};

it.each([false, true])(
  'preserves existing root array rows in popup/inline mode: %s',
  async (inline) => {
    const wrapper = mount(JsonSchemaFormField, {
      attachTo: document.body,
      props: {
        inline,
        schema: rootArraySchema,
        modelValue: JSON.stringify([{ address: 'old@example.com' }]),
      },
    });
    if (!inline) {
      await wrapper.get('button').trigger('click');
      await flushPromises();
    }
    const input = wrapper.findAllComponents(Input).at(-1);
    expect(input?.props('value')).toBe('old@example.com');
    input?.vm.$emit('update:value', 'edited@example.com');
    await flushPromises();
    if (!inline) {
      wrapper.findComponent(Modal).vm.$emit('ok');
      await flushPromises();
    }
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      { address: 'edited@example.com' },
    ]);
    wrapper.unmount();
  },
);
