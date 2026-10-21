import type { Component, PropType, VNode } from 'vue';
import type { RouteLocationNormalizedLoadedGeneric } from 'vue-router';

import { cloneVNode, defineComponent, h, isVNode, KeepAlive } from 'vue';

type NameableComponent = Component & {
  __name?: string;
  name?: string;
};
type RouteViewComponent = Component | string | VNode;

function getRouteComponentName(component: RouteViewComponent) {
  const item = isVNode(component) ? component.type : component;

  if (typeof item !== 'function' && typeof item !== 'object') {
    return;
  }

  const nameableItem = item as NameableComponent;
  return nameableItem.name || nameableItem.__name;
}

function transformRouteComponent(component: RouteViewComponent) {
  if (!component) {
    console.error(
      'Component view not found，please check the route configuration',
    );
    return undefined;
  }

  return component;
}

// 同一组件可被多个路由复用；使用稳定包装对齐路由名，不改写原组件定义。
const namedRouteWrappers = new WeakMap<object, Map<string, Component>>();

function withRouteCacheName(vnode: VNode, routeName: string) {
  const type = vnode.type;
  if (
    !routeName ||
    !type ||
    (typeof type !== 'object' && typeof type !== 'function') ||
    getRouteComponentName(type as Component) === routeName
  )
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

export const RouteContentRenderer = defineComponent({
  name: 'RouteContentRenderer',
  props: {
    component: {
      required: true,
      type: null as unknown as PropType<RouteViewComponent>,
    },
    exclude: {
      default: undefined,
      type: [Array, String, RegExp] as PropType<RegExp | string | string[]>,
    },
    include: {
      default: undefined,
      type: [Array, String, RegExp] as PropType<RegExp | string | string[]>,
    },
    keepAlive: {
      default: false,
      type: Boolean,
    },
    route: {
      required: true,
      type: Object as PropType<RouteLocationNormalizedLoadedGeneric>,
    },
    routeKey: {
      required: true,
      type: String,
    },
  },
  setup(props) {
    return () => {
      const component = transformRouteComponent(props.component);

      if (!component) {
        return null;
      }

      const content = isVNode(component)
        ? cloneVNode(component, { key: props.routeKey })
        : h(component as Component | string, { key: props.routeKey });
      const routeName = String(props.route.name || '');
      const routeView = props.keepAlive
        ? withRouteCacheName(content, routeName)
        : content;

      if (!props.keepAlive) {
        return routeView;
      }

      return h(
        KeepAlive,
        {
          exclude: props.exclude,
          include: props.include,
        },
        {
          default: () => routeView,
        },
      );
    };
  },
});

export { transformRouteComponent };
