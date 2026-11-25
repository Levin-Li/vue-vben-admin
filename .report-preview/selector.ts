import { defineComponent, h } from 'vue';
import { Select } from 'ant-design-vue';

export const UserOrgSelector = defineComponent({
  props: { modelValue: String }, emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h(Select, { value: props.modelValue || '', style: { width: '160px' },
      options: [{ value: '', label: '全部组织' }, { value: 'north', label: '华北组织' }, { value: 'south', label: '华南组织' }],
      'onUpdate:value': (value: string) => emit('update:modelValue', value),
    });
  },
});
