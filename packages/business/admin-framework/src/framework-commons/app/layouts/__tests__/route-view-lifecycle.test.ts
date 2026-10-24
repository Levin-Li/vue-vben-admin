/* eslint-disable vue/one-component-per-file */
import { flushPromises, mount } from '@vue/test-utils';
import {
  defineComponent,
  h,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue';
import {
  createMemoryHistory,
  createRouter,
  RouterView,
  useRoute,
} from 'vue-router';

import { describe, expect, it, vi } from 'vitest';

import { RouteContentRenderer } from '../../../../../../../effects/layouts/src/basic/content/route-content-renderer';
import RouteView from '../route-view.vue';

vi.mock('@vben/runtime/stores', () => ({
  getTabKey: (route: {
    fullPath: string;
    meta: { fullPathKey?: boolean };
    path: string;
  }) => (route.meta.fullPathKey === false ? route.path : route.fullPath),
}));

describe('嵌套路由的标签实例生命周期', () => {
  it('十轮往返只挂载每个标签一次，并保留状态和隔离失活页路由', async () => {
    const mounted: string[] = [];
    const unmounted: string[] = [];
    const observedRoutes: Array<[string, string]> = [];
    const activePages = new Set<string>();
    const include = ref(['_group_a_one', '_group_a_two', '_group_b_three']);
    const paths = ['/group/a/one', '/group/a/two', '/group/b/three'] as const;
    const page = (path: string) =>
      defineComponent({
        name: 'SharedCrudPage',
        setup() {
          const currentRoute = useRoute();
          const count = ref(1);
          onMounted(() => mounted.push(path));
          onUnmounted(() => unmounted.push(path));
          onActivated(() => activePages.add(path));
          onDeactivated(() => activePages.delete(path));
          watch(
            () => currentRoute.fullPath,
            (value) => observedRoutes.push([path, value]),
          );
          return () =>
            h(
              'button',
              { onClick: () => count.value++ },
              `${path}:${count.value}`,
            );
        },
      });

    // 与实际布局相同：外层按标签键缓存父路由，父路由内再显示叶页面。
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          children: [
            {
              children: [
                {
                  component: page(paths[0]),
                  name: '_group_a_one',
                  path: 'one',
                },
                {
                  component: page(paths[1]),
                  name: '_group_a_two',
                  path: 'two',
                },
              ],
              component: RouteView,
              path: 'a',
            },
            {
              children: [
                {
                  component: page(paths[2]),
                  name: '_group_b_three',
                  path: 'three',
                },
              ],
              component: RouteView,
              path: 'b',
            },
          ],
          component: RouteView,
          meta: { fullPathKey: false, title: '测试标签' },
          path: '/group',
        },
      ],
    });
    await router.push(paths[0]);
    await router.isReady();
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(RouterView, null, {
            default: ({ Component, route }: any) =>
              h(RouteContentRenderer, {
                component: Component,
                include: include.value,
                keepAlive: true,
                route,
                routeKey: route.path,
              }),
          }),
      }),
      { global: { plugins: [router] } },
    );
    await flushPromises();
    await wrapper.find('button').trigger('click');

    for (let round = 0; round < 10; round++) {
      for (const path of [...paths.slice(1), paths[0]]) {
        await router.push(path);
        await flushPromises();
        expect(wrapper.findAll('button')).toHaveLength(1);
        expect([...activePages]).toEqual([path]);
      }
    }

    expect(mounted).toEqual(paths);
    expect(wrapper.find('button').text()).toBe(`${paths[0]}:2`);
    expect(observedRoutes).toEqual([]);
    expect(unmounted).toEqual([]);

    // 复用同标签的查询参数仍会传到本标签，不触及其它缓存标签。
    await router.push(`${paths[0]}?search=updated`);
    await flushPromises();
    expect(mounted).toEqual(paths);
    expect(wrapper.find('button').text()).toBe(`${paths[0]}:2`);
    expect(observedRoutes).toEqual([[paths[0], `${paths[0]}?search=updated`]]);

    // 关闭标签需销毁其完整页面树，重新打开才重新挂载。
    include.value = include.value.filter((name) => name !== '_group_a_two');
    await nextTick();
    expect(unmounted).toEqual([paths[1]]);
    include.value.push('_group_a_two');
    await router.push(paths[1]);
    await flushPromises();
    expect(mounted).toEqual([...paths, paths[1]]);
    expect(wrapper.find('button').text()).toBe(`${paths[1]}:1`);
    wrapper.unmount();
    expect(unmounted).toHaveLength(4);
    expect(activePages.size).toBe(0);
  });
});
