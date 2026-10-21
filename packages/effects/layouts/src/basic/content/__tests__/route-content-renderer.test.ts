import type { RouteLocationNormalizedLoadedGeneric } from 'vue-router';

import { mount } from '@vue/test-utils';
/* eslint-disable vue/one-component-per-file */
import { defineComponent, h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { RouteContentErrorBoundary } from '../route-content-error-boundary';
import { RouteContentRenderer } from '../route-content-renderer';

const refresh = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@vben/runtime/hooks', () => ({
  useRefresh: () => ({
    refresh,
  }),
}));

const HealthyPage = defineComponent({
  name: 'HealthyPage',
  setup: () => () => h('div', { 'data-testid': 'healthy-page' }, '正常页面'),
});

function createRoute(name: string) {
  return {
    fullPath: `/${name}`,
    meta: {},
    name,
    path: `/${name}`,
    query: {},
  } as unknown as RouteLocationNormalizedLoadedGeneric;
}

describe('routeContentRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    refresh.mockReset();
  });

  it('renders the vnode provided by router-view slots', () => {
    const wrapper = mount(RouteContentRenderer, {
      props: {
        component: h(HealthyPage),
        keepAlive: false,
        route: createRoute('healthy-route'),
        routeKey: 'healthy-route',
      },
    });

    expect(wrapper.find('[data-testid="healthy-page"]').text()).toBe(
      '正常页面',
    );
  });

  it('caches a named page when its component name differs from the route name', async () => {
    const mounted = vi.fn();
    const Page = defineComponent({
      name: 'ReusablePage',
      setup() {
        const page = ref(1);
        mounted();
        return () =>
          h('button', { onClick: () => page.value++ }, `第 ${page.value} 页`);
      },
    });
    const Other = defineComponent({
      name: 'OtherPage',
      setup: () => () => h('div', '其它页面'),
    });
    const wrapper = mount(RouteContentRenderer, {
      props: {
        component: h(Page),
        include: [],
        keepAlive: true,
        route: createRoute('Drama'),
        routeKey: '/Drama',
      },
    });

    await wrapper.find('button').trigger('click');
    await wrapper.setProps({ include: ['Drama', 'OtherPage'] });
    await wrapper.setProps({
      component: h(Other),
      route: createRoute('OtherPage'),
      routeKey: '/OtherPage',
    });
    await wrapper.setProps({
      component: h(Page),
      route: createRoute('Drama'),
      routeKey: '/Drama',
    });

    expect(wrapper.find('button').text()).toBe('第 2 页');
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('keeps rendering when route component metadata cannot be extended', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const AnonymousPage = Object.freeze(
      defineComponent({
        setup: () => () =>
          h('div', { 'data-testid': 'anonymous-page' }, '匿名页面'),
      }),
    );

    const wrapper = mount(RouteContentRenderer, {
      props: {
        component: h(AnonymousPage),
        keepAlive: false,
        route: createRoute('anonymous-route'),
        routeKey: 'anonymous-route',
      },
    });

    expect(wrapper.find('[data-testid="anonymous-page"]').text()).toBe(
      '匿名页面',
    );
  });

  it('lets the route boundary recover after renderer-level failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const brokenRoute = {
      fullPath: '/broken-route',
      meta: {},
      path: '/broken-route',
      query: {},
    } as unknown as RouteLocationNormalizedLoadedGeneric;

    Object.defineProperty(brokenRoute, 'name', {
      get() {
        throw new Error('broken route metadata');
      },
    });

    const wrapper = mount({
      components: {
        RouteContentErrorBoundary,
        RouteContentRenderer,
      },
      data: () => ({
        route: brokenRoute,
        routeKey: 'broken-route',
      }),
      template: `
        <RouteContentErrorBoundary :route-key="routeKey">
          <RouteContentRenderer
            :component="component"
            :keep-alive="false"
            :route="route"
            :route-key="routeKey"
          />
        </RouteContentErrorBoundary>
      `,
      computed: {
        component() {
          return h(HealthyPage);
        },
      },
    });

    await nextTick();

    expect(wrapper.text()).toContain('当前页面渲染失败');
    expect(wrapper.text()).toContain('broken route metadata');

    await wrapper.setData({
      route: createRoute('healthy-route'),
      routeKey: 'healthy-route',
    });
    await nextTick();

    expect(wrapper.text()).not.toContain('当前页面渲染失败');
    expect(wrapper.find('[data-testid="healthy-page"]').text()).toBe(
      '正常页面',
    );
  });
});
