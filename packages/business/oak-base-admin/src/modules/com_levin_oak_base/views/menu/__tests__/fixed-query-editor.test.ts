import { flushPromises, shallowMount } from '@vue/test-utils';

import { Button, Modal } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import FixedQueryEditor from '../fixed-query-editor.vue';

vi.mock('@vben/stores', () => ({ useUserStore: () => ({ userInfo: {} }) }));
vi.mock(
  '@levin/admin-framework/framework-commons/app/api/json-schema-service',
  () => ({
    jsonSchemaService: {
      genJsonSchema: vi.fn().mockRejectedValue(new Error('加载失败')),
    },
  }),
);
vi.mock('@levin/admin-framework/framework-commons/runtime', () => ({
  requestClient: { get: vi.fn().mockRejectedValue(new Error('加载失败')) },
}));

async function openEditor(props: Record<string, any>) {
  const wrapper = shallowMount(FixedQueryEditor, {
    props,
    global: { renderStubDefaultSlot: true },
  });
  wrapper.findComponent(Button).vm.$emit('click');
  await flushPromises();
  return wrapper;
}

describe('菜单参数编辑器回退', () => {
  it('没有公共查询配置时使用JSON，保存仍为原对象', async () => {
    const wrapper = await openEditor({
      modelValue: { success: false, count: 0 },
    });
    expect(wrapper.findComponent({ name: 'json-editor-field' }).exists()).toBe(
      true,
    );
    wrapper.findComponent(Modal).vm.$emit('ok');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      { success: false, count: 0 },
    ]);
    wrapper.unmount();
  });
  it('schema加载失败后回退JSON且不丢失现有条件', async () => {
    const wrapper = await openEditor({
      modelValue: { names: ['甲'] },
      paramsEditor: 'class:demo.Query',
    });
    expect(wrapper.findComponent({ name: 'json-editor-field' }).exists()).toBe(
      true,
    );
    wrapper.findComponent(Modal).vm.$emit('ok');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      { names: ['甲'] },
    ]);
    wrapper.unmount();
  });
  it('显式Schema优先于页面查询配置且保留原有值', async () => {
    const loadConfig = vi.fn();
    const wrapper = await openEditor({
      modelValue: { count: 0 },
      paramsEditor:
        '{"type":"object","properties":{"count":{"type":"number"}}}',
      loadConfig,
    });
    expect(loadConfig).not.toHaveBeenCalled();
    expect(
      wrapper.findComponent({ name: 'json-schema-form-field' }).exists(),
    ).toBe(true);
    wrapper.findComponent(Modal).vm.$emit('ok');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([{ count: 0 }]);
    wrapper.unmount();
  });
});
