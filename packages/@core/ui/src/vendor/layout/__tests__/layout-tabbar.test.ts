import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import LayoutTabbar from '../components/layout-tabbar.vue';

describe('标签栏布局', () => {
  it('在结构定位偏移的基础上保留左右外边距', () => {
    const wrapper = mount(LayoutTabbar, {
      props: {
        height: 40,
        layoutMarginLeft: 200,
        layoutWidthOffset: 200,
        marginLeft: 27,
        marginRight: 12,
      },
    });

    const element = wrapper.element as HTMLElement;
    expect(element.style.marginLeft).toBe('227px');
    expect(element.style.marginRight).toBe('12px');
    expect(element.style.width).toBe('calc(100% - 239px)');

    wrapper.unmount();
  });
});
