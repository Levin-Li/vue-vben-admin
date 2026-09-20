import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import JsonSchemaRuntimeForm from '../json-schema-runtime-form.vue';

describe('运行时 Schema 递归表单', () => {
  it('为对象数组提供新增和删除入口', async () => {
    const wrapper = mount(JsonSchemaRuntimeForm, {
      props: {
        modelValue: { endpoints: [] },
        schema: {
          properties: {
            endpoints: {
              items: {
                properties: { url: { title: '地址', type: 'string' } },
                type: 'object',
              },
              title: '备用端点',
              type: 'array',
            },
          },
        },
      },
    });

    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      { endpoints: [{}] },
    ]);
  });
});
