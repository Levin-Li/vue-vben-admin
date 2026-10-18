import type { RouteLocationNormalizedLoadedGeneric } from 'vue-router';

import { mount } from '@vue/test-utils';
/* eslint-disable vue/one-component-per-file */
import { defineComponent, h, nextTick, onMounted, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { RouteViewRenderer } from '../route-view-renderer';

vi.mock('@vben-core/foundation/preferences', () => ({
  usePreferences: () => ({ keepAlive: { value: true } }),
}));

vi.mock('@vben/runtime/stores', () => ({
  getTabKey: (route: { fullPath: string }) => route.fullPath,
  storeToRefs: () => ({
    getCachedTabs: { value: ['CrudPage', 'OtherPage'] },
    getExcludeCachedTabs: { value: [] },
  }),
  useTabbarStore: () => ({}),
}));

function route(name: string) {
  return {
    fullPath: `/${name}`,
    name,
    path: `/${name}`,
  } as RouteLocationNormalizedLoadedGeneric;
}

describe('routeViewRenderer', () => {
  it('retains CRUD pagination state when a cached tab is revisited', async () => {
    const mounted = vi.fn();
    const active = ref<'CrudPage' | 'OtherPage' | undefined>('CrudPage');
    const CrudPage = defineComponent({
      name: 'CrudPage',
      setup() {
        const page = ref(1);
        onMounted(mounted);
        return () =>
          h('button', { onClick: () => page.value++ }, `第 ${page.value} 页`);
      },
    });
    const OtherPage = defineComponent({
      name: 'OtherPage',
      setup: () => () => h('div', '其它页面'),
    });
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(RouteViewRenderer, {
            component: active.value
              ? h(active.value === 'CrudPage' ? CrudPage : OtherPage)
              : undefined,
            route: route(active.value || 'outside'),
          }),
      }),
    );

    await wrapper.find('button').trigger('click');
    active.value = undefined;
    await nextTick();
    active.value = 'OtherPage';
    await nextTick();
    active.value = 'CrudPage';
    await nextTick();

    expect(wrapper.find('button').text()).toBe('第 2 页');
    expect(mounted).toHaveBeenCalledTimes(1);
  });
});
