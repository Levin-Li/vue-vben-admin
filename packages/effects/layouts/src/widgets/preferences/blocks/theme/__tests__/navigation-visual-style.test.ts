import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { describe, expect, it } from 'vitest';

import NavigationVisualStyle from '../navigation-visual-style.vue';

const ToggleItemStub = defineComponent({
  name: 'ToggleItem',
  props: {
    items: {
      default: () => [],
      type: Array,
    },
    modelValue: {
      default: '',
      type: String,
    },
  },
  emits: ['update:modelValue'],
  setup(_, { slots }) {
    return () => h('div', slots.default?.());
  },
});

describe('preference navigation visual style', () => {
  it('exposes all visual themes and persists the selected value', () => {
    const wrapper = mount(NavigationVisualStyle, {
      global: {
        stubs: {
          ToggleItem: ToggleItemStub,
        },
      },
      props: {
        navigationVisualStyle: 'brand-gradient',
        navigationGradientEndColor: '#fff4f5',
        navigationGradientTransitionColor: '#f1efff',
        navigationGradientTransitionColorEnabled: false,
      },
    });

    const toggle = wrapper.findComponent(ToggleItemStub);
    expect(toggle.text()).toBe('导航主题');
    expect(toggle.props('items')).toEqual([
      { label: '默认主题', value: 'minimal' },
      { label: '主题渐变', value: 'brand-gradient' },
    ]);

    toggle.vm.$emit('update:modelValue', 'minimal');
    expect(wrapper.emitted('update:navigationVisualStyle')).toEqual([
      ['minimal'],
    ]);
  });

  it('shows two color controls only for the gradient theme', async () => {
    const wrapper = mount(NavigationVisualStyle, {
      global: {
        stubs: {
          ToggleItem: ToggleItemStub,
        },
      },
      props: {
        navigationGradientEndColor: '#fff4f5',
        navigationGradientTransitionColor: '#f1efff',
        navigationGradientTransitionColorEnabled: false,
        navigationVisualStyle: 'brand-gradient',
      },
    });

    expect(wrapper.text()).toContain('渐变色');
    expect(wrapper.text()).toContain('表格');
    expect(wrapper.text()).toContain('过渡色');
    expect(wrapper.find('[aria-label="过渡色"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="最终色"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="表头渐变"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="工具栏渐变"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="整个表格渐变"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="表行渐变"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="侧边栏渐变"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="顶栏渐变"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="标签栏渐变"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="查询面板渐变"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="新增表单渐变"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="编辑表单渐变"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="详情表单渐变"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('工具栏表头整表');
    expect(
      wrapper.find('[aria-label="过渡色"]').attributes('disabled'),
    ).toBeDefined();

    await wrapper.setProps({ navigationGradientTransitionColorEnabled: true });
    await wrapper.find('[aria-label="过渡色"]').trigger('click');
    expect(wrapper.emitted('openColorSettings')).toEqual([
      ['gradientTransition'],
    ]);
  });
});
