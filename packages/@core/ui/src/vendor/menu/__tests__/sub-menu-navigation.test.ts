import { mount } from '@vue/test-utils';
import { h } from 'vue';
import { describe, expect, it } from 'vitest';

import Menu from '../components/menu.vue';
import SubMenu from '../sub-menu.vue';

describe('submenu navigation', () => {
  it('selects a navigable submenu while preserving its expand interaction', async () => {
    const wrapper = mount(Menu, {
      props: { mode: 'vertical' },
      slots: {
        default: () => h(SubMenu, {
          menu: {
            children: [{ name: '子菜单', path: '/group/child' }],
            name: '可访问分组',
            navigateOnClick: true,
            path: '/group',
          },
        }),
      },
    });

    await wrapper.getComponent({ name: 'SubMenuContent' }).trigger('click');

    expect(wrapper.emitted('open')).toEqual([['/group', ['/group']]]);
    expect(wrapper.emitted('select')).toEqual([['/group', ['/group']]]);
    wrapper.unmount();
  });

  it('only expands a submenu when it is not marked as navigable', async () => {
    const wrapper = mount(Menu, {
      props: { mode: 'vertical' },
      slots: {
        default: () => h(SubMenu, {
          menu: {
            children: [{ name: '子菜单', path: '/group/child' }],
            name: '普通分组',
            path: '/group',
          },
        }),
      },
    });

    await wrapper.getComponent({ name: 'SubMenuContent' }).trigger('click');

    expect(wrapper.emitted('open')).toEqual([['/group', ['/group']]]);
    expect(wrapper.emitted('select')).toBeUndefined();
    wrapper.unmount();
  });

  it('prevents browser text selection from the submenu click area', () => {
    const wrapper = mount(Menu, {
      props: { mode: 'vertical' },
      slots: {
        default: () => h(SubMenu, {
          menu: {
            children: [{ name: '子菜单', path: '/group/child' }],
            name: '分组菜单',
            path: '/group',
          },
        }),
      },
    });

    const event = new Event('selectstart', {
      bubbles: true,
      cancelable: true,
    });

    expect(
      wrapper
        .getComponent({ name: 'SubMenuContent' })
        .element.dispatchEvent(event),
    ).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    wrapper.unmount();
  });

});
