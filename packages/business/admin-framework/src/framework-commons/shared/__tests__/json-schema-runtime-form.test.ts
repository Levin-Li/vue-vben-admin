import { mount } from '@vue/test-utils';

import { Select } from 'ant-design-vue';
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

const targetSchema = {
  type: 'array',
  title: '投递目标',
  items: {
    type: 'object',
    properties: {
      type: {
        oneOf: [
          { const: 'Email', title: '邮箱' },
          { const: 'Webhook', title: '回调' },
        ],
      },
      address: { type: 'string', title: '地址' },
    },
  },
};

it('edits a root collection without replacing its array value or existing rows', async () => {
  const wrapper = mount(JsonSchemaRuntimeForm, {
    props: {
      schema: targetSchema,
      modelValue: [{ type: 'Email', address: 'old@example.com' }],
    },
  });
  const add = wrapper
    .findAll('button')
    .find((button) => button.text() === '新增一项');
  expect(add).toBeDefined();
  await add?.trigger('click');
  const added = wrapper.emitted('update:modelValue')?.at(-1)?.[0];
  expect(added).toEqual([{ type: 'Email', address: 'old@example.com' }, {}]);
  await wrapper.setProps({ modelValue: added });
  await wrapper.findAll('input').at(-1)?.setValue('new@example.com');
  const edited = wrapper.emitted('update:modelValue')?.at(-1)?.[0];
  expect(edited).toEqual([
    { type: 'Email', address: 'old@example.com' },
    { address: 'new@example.com' },
  ]);
  await wrapper.setProps({ modelValue: edited });
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '删除')
    ?.trigger('click');
  expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
    { address: 'new@example.com' },
  ]);
  wrapper.unmount();
});

it('shows an add control for an empty root array', () => {
  const wrapper = mount(JsonSchemaRuntimeForm, {
    props: { schema: targetSchema, modelValue: [] },
  });
  expect(wrapper.text()).toContain('新增一项');
  wrapper.unmount();
});

it('selects actual const/enum values rather than a cosmetic branch index', async () => {
  const wrapper = mount(JsonSchemaRuntimeForm, {
    props: {
      schema: {
        properties: {
          target: {
            oneOf: [
              { const: 'Email', title: '邮箱' },
              { enum: ['Webhook', 'Queue'] },
            ],
          },
        },
      },
      modelValue: {},
    },
  });
  const select = wrapper.getComponent(Select);
  expect(select.props('value')).toBeUndefined();
  expect(select.props('options')).toEqual([
    { label: '邮箱', value: 'Email' },
    { label: 'Webhook', value: 'Webhook' },
    { label: 'Queue', value: 'Queue' },
  ]);
  select.vm.$emit('update:value', 'Email');
  expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
    target: 'Email',
  });
  wrapper.unmount();
});

it('retains object branches and their recursive controls', async () => {
  const wrapper = mount(JsonSchemaRuntimeForm, {
    props: {
      schema: {
        properties: {
          delivery: {
            oneOf: [
              {
                title: '邮箱',
                type: 'object',
                properties: { address: { type: 'string' } },
              },
              {
                title: '回调',
                type: 'object',
                properties: { url: { type: 'string' } },
              },
            ],
          },
        },
      },
      modelValue: { delivery: { address: 'old@example.com' } },
    },
  });
  expect(wrapper.findAll('input').at(-1)?.element.value).toBe(
    'old@example.com',
  );
  await wrapper.findAll('input').at(-1)?.setValue('next@example.com');
  expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
    delivery: { address: 'next@example.com' },
  });
  wrapper.unmount();
});
