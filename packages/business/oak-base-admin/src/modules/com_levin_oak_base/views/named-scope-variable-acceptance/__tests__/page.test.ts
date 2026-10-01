import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import AcceptancePage from '../index.vue';

const api = vi.hoisted(() => ({
  oakBaseGet: vi.fn().mockResolvedValue({ items: [] }),
  oakBasePost: vi.fn().mockResolvedValue({
    data: { headers: {}, resolved: { domainId: 'domain-a' }, submitted: {} },
  }),
}));

vi.mock('../../../api/_module', () => api);
vi.mock('ant-design-vue', () => {
  const box = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) });
  const button = defineComponent({
    setup: (_, { attrs, slots }) => () => h('button', attrs, slots.default?.()),
  });
  return { Alert: box, Button: button, Card: box, Form: Object.assign(box, { Item: box }), Select: box };
});

describe('具名数据范围变量验收页', () => {
  it('提交后展示后端的原始参数、Header 与最终解析结果', async () => {
    const wrapper = mount(AcceptancePage);
    await flushPromises();
    const submitButton = wrapper.findAll('button')[2];
    if (!submitButton) throw new Error('缺少提交按钮');
    await submitButton.trigger('click');
    await flushPromises();

    expect(api.oakBasePost).toHaveBeenCalledWith('/namedScopeVariableAcceptance/echo', expect.any(Object));
    expect(wrapper.text()).toContain('headers 和 resolved');
    expect(wrapper.text()).toContain('domain-a');
  });
});
