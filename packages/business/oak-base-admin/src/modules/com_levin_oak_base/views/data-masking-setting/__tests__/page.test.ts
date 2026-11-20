import { mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import Page from '../index.vue';

vi.mock('../../crud-page.vue', () => ({
  default: {
    template:
      '<div><slot name="table-cell-enable" :record="{ enable: true }"/><slot name="table-cell-enable" :record="{ enable: false }"/><slot name="table-cell-enable" :record="{}"/></div>',
    props: ['config'],
  },
}));
vi.mock('../rule-editor.vue', () => ({ default: { template: '<div />' } }));

describe('数据脱敏设置启用状态', () => {
  it('列表只展示状态，必须通过完整编辑表单修改', () => {
    const wrapper = mount(Page);
    expect(wrapper.text()).toContain('启用');
    expect(wrapper.text()).toContain('禁用');
    expect(wrapper.text()).toContain('—');
    expect(wrapper.find('[role="switch"]').exists()).toBe(false);
    expect(wrapper.find('button').exists()).toBe(false);
    wrapper.unmount();
  });
});
