import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import NoticeAreaScopeField from '../notice-area-scope-field.vue';

const AreaCascaderStub = {
  emits: ['change', 'update:modelValue'],
  props: ['modelValue', 'selectableLevels'],
  template:
    '<button type="button" @click="$emit(\'change\', \'440300\')">选择区域</button>',
};

const TagStub = {
  emits: ['close'],
  template:
    '<button class="area-tag" type="button" @click="$emit(\'close\')"><slot /></button>',
};

describe('通知投放区域选择', () => {
  it('使用行政区划选择器并以编码数组回写省、市、区县范围', async () => {
    const wrapper = mount(NoticeAreaScopeField, {
      props: { modelValue: ['440000'] },
      global: {
        stubs: {
          ATag: TagStub,
          AdministrativeAreaCascader: AreaCascaderStub,
        },
      },
    });

    const cascader = wrapper.getComponent(AreaCascaderStub);
    expect(cascader.props('selectableLevels')).toEqual([
      'province',
      'city',
      'district',
    ]);
    expect(wrapper.text()).toContain('广东省');

    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      ['440000', '440300'],
    ]);
  });

  it('去重并允许删除已选范围', async () => {
    const wrapper = mount(NoticeAreaScopeField, {
      props: { modelValue: ['440300', '440300'] },
      global: {
        stubs: {
          ATag: TagStub,
          AdministrativeAreaCascader: AreaCascaderStub,
        },
      },
    });

    expect(wrapper.findAll('.area-tag')).toHaveLength(1);
    await wrapper.find('.area-tag').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]]);
  });
});
