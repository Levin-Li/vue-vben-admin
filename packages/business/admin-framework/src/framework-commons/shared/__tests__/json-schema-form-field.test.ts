import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { Input, Modal } from 'ant-design-vue';

import JsonSchemaFormField from '../json-schema-form-field.vue';

describe('json schema form field', () => {
  afterEach(() => {
    document.body.innerHTML = '';
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
