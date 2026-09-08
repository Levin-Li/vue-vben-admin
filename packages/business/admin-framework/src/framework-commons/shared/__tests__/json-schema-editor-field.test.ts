import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import JsonSchemaEditorField from '../json-schema-editor-field.vue';

describe('json schema editor field', () => {
  it('保留无效嵌套JSON草稿，修正前不把旧值回传为成功编辑', async () => {
    const wrapper = mount(JsonSchemaEditorField, {
      props: {
        inline: true,
        modelValue: { name: 'Alice', tags: ['one'] },
        schemaSource: {
          type: 'object',
          properties: {
            name: { title: '名称', type: 'string' },
            tags: { title: '标签', type: 'array', items: { type: 'string' } },
          },
        },
      },
    });
    await flushPromises();
    const json = wrapper.find('textarea');
    await json.setValue('["unfinished"');
    expect(wrapper.emitted('validity')?.at(-1)).toEqual([false]);
    await wrapper.find('input[value="Alice"]').setValue('Bob');
    expect((json.element as HTMLTextAreaElement).value).toBe('["unfinished"');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await json.setValue('["two"]');
    expect(wrapper.emitted('validity')?.at(-1)).toEqual([true]);
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      name: 'Bob',
      tags: ['two'],
    });
  });

  it('renders inline structured fields from inline schema metadata', async () => {
    const wrapper = mount(JsonSchemaEditorField, {
      props: {
        inline: true,
        modelValue: {
          name: 'Alice',
        },
        schemaSource: {
          properties: {
            enabled: {
              title: '启用',
              type: 'boolean',
            },
            name: {
              title: '名称',
              type: 'string',
            },
          },
          type: 'object',
        },
        title: '扩展信息',
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('名称');
    expect(wrapper.text()).toContain('启用');
    expect(wrapper.emitted('ready')?.at(-1)).toEqual([true]);
    expect(wrapper.find('input[value="Alice"]').exists()).toBe(true);
  });

  it('uses schema metadata inside the json value and preserves it on edit', async () => {
    const schemaText = JSON.stringify({
      properties: {
        name: {
          title: '名称',
          type: 'string',
        },
      },
      type: 'object',
    });
    const wrapper = mount(JsonSchemaEditorField, {
      props: {
        inline: true,
        modelValue: {
          '@JsonSchema': schemaText,
          name: 'Alice',
        },
        title: '扩展信息',
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('名称');

    const input = wrapper.find('input[value="Alice"]');
    await input.setValue('Bob');

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      '@JsonSchema': schemaText,
      name: 'Bob',
    });
  });
});
