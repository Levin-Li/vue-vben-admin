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

function setRouteComponentName(
  component: RouteViewComponent,
  routeName: string,
) {
  const item = isVNode(component) ? component.type : component;

  if (typeof item !== 'function' && typeof item !== 'object') {
    return;
  }

  if (!Object.isExtensible(item)) {
    return;
  }

  const nameableItem = item as NameableComponent;

  if (!nameableItem.name) {
    Reflect.set(nameableItem, 'name', routeName);
  }
}

function transformRouteComponent(
  component: RouteViewComponent,
  route: RouteLocationNormalizedLoadedGeneric,
) {
  if (!component) {
    console.error(
      'Component view not found，please check the route configuration',
    );
    return undefined;
  }

  const routeName = route.name as string;

  let hasComponentName = false;
  try {
    hasComponentName = Boolean(getRouteComponentName(component));
  } catch (error) {
    console.error(error);
    hasComponentName = true;
  }

  if (!routeName || hasComponentName) {
    return component;
  }

  try {
    setRouteComponentName(component, routeName);
  } catch (error) {
    console.error(error);
  }

  return component;
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
      const component = transformRouteComponent(props.component, props.route);

      if (!component) {
        return null;
      }

      const routeView = isVNode(component)
        ? cloneVNode(component, { key: props.routeKey })
        : h(component as Component | string, { key: props.routeKey });

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
