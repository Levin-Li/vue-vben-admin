import { flushPromises, shallowMount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import LegalSubjectPicker from '../legal-subject-picker.vue';

const mocked = vi.hoisted(() => ({ load: vi.fn(), retrieve: vi.fn() }));

vi.mock('../../../api/legal-subject-service', () => ({
  legalSubjectService: { retrieve: mocked.retrieve },
}));
vi.mock('../../api-module', () => ({
  buildModuleOptionsLoader: () => mocked.load,
}));

const SelectStub = defineComponent({
  name: 'ASelect',
  props: { disabled: Boolean, options: { type: Array, default: () => [] } },
  emits: ['search', 'update:value'],
  template: '<div />',
});

describe('法律主体选择控件', () => {
  it('合作关系编辑时禁止修改主体 ID', async () => {
    mocked.load.mockResolvedValue([]);
    mocked.retrieve.mockResolvedValue({
      data: { id: 'subject-1', subjectName: '甲公司' },
    });
    const wrapper = shallowMount(LegalSubjectPicker, {
      props: { disabled: true, modelValue: 'subject-1' },
      global: { stubs: { ASelect: SelectStub } },
    });
    const select = wrapper.findComponent(SelectStub);

    expect(select.props('disabled')).toBe(true);
    select.vm.$emit('update:value', 'subject-2');
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    wrapper.unmount();
  });

  it('搜索其它主体后仍保留已选主体的名称', async () => {
    mocked.load.mockResolvedValue([]);
    mocked.retrieve.mockResolvedValue({
      data: { id: 'subject-1', subjectName: '甲公司' },
    });
    const wrapper = shallowMount(LegalSubjectPicker, {
      props: { modelValue: 'subject-1' },
      global: { stubs: { ASelect: SelectStub } },
    });
    await flushPromises();

    const select = wrapper.findComponent(SelectStub);
    select.vm.$emit('search', '其它');
    await flushPromises();

    expect(select.props('options')).toContainEqual({
      label: '甲公司',
      value: 'subject-1',
    });
    wrapper.unmount();
  });
});
