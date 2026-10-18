import type { Component, PropType, VNode } from 'vue';
import type { RouteLocationNormalizedLoadedGeneric } from 'vue-router';

import { cloneVNode, defineComponent, h, isVNode, KeepAlive } from 'vue';

import { getTabKey, storeToRefs, useTabbarStore } from '@vben/runtime/stores';

import { usePreferences } from '@vben-core/foundation/preferences';

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
        routeView = isVNode(props.component)
          ? cloneVNode(props.component, { key })
          : h(props.component as Component | string, { key });
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
