import type { Component, PropType, VNode } from 'vue';
import type { RouteLocationNormalizedLoadedGeneric } from 'vue-router';

import { cloneVNode, defineComponent, h, isVNode, KeepAlive } from 'vue';

import { getTabKey, storeToRefs, useTabbarStore } from '@vben/runtime/stores';

import { usePreferences } from '@vben-core/foundation/preferences';

// 内层路由也按路由名缓存，避免业务页自带的 index 等名称错过标签缓存名单。
const namedRouteWrappers = new WeakMap<object, Map<string, Component>>();

function withRouteCacheName(vnode: VNode, routeName: string) {
  const type = vnode.type;
  if (
    !routeName ||
    !type ||
    (typeof type !== 'object' && typeof type !== 'function')
  )
    return vnode;
  const named = type as Component & { __name?: string; name?: string };
  if (named.name === routeName || (!named.name && named.__name === routeName))
    return vnode;

  let byName = namedRouteWrappers.get(type as object);
  if (!byName) {
    byName = new Map();
    namedRouteWrappers.set(type as object, byName);
  }
  let wrapper = byName.get(routeName);
  if (!wrapper) {
    wrapper = defineComponent({
      name: routeName,
      props: {
        content: { required: true, type: Object as PropType<VNode> },
      },
      setup(props) {
        return () => cloneVNode(props.content);
      },
    });
    byName.set(routeName, wrapper);
  }
  return h(wrapper, { content: vnode, key: vnode.key });
}

export const RouteViewRenderer = defineComponent({
  name: 'RouteViewRenderer',
  props: {
    component: {
      default: undefined,
      type: null as unknown as PropType<Component | string | undefined | VNode>,
    },
    route: {
      required: true,
      type: Object as PropType<RouteLocationNormalizedLoadedGeneric>,
    },
  },
  setup(props) {
    const { keepAlive } = usePreferences();
    const { getCachedTabs, getExcludeCachedTabs } =
      storeToRefs(useTabbarStore());

    return () => {
      let key: string;
      try {
        key = getTabKey(props.route);
      } catch (error) {
        console.error(error);
        key = String(props.route.name || props.route.path);
      }

      let routeView: null | VNode = null;
      if (props.component) {
        const content = isVNode(props.component)
          ? cloneVNode(props.component, { key })
          : h(props.component as Component | string, { key });
        routeView = keepAlive.value
          ? withRouteCacheName(content, String(props.route.name || ''))
          : content;
      }

      return keepAlive.value
        ? h(
            KeepAlive,
            {
              exclude: getExcludeCachedTabs.value,
              include: getCachedTabs.value,
            },
            { default: () => routeView },
          )
        : routeView;
    };
  },
});
