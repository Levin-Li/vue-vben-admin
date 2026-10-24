import type { Component, PropType, VNode } from 'vue';
import type { RouteLocationNormalizedLoadedGeneric } from 'vue-router';

import { cloneVNode, defineComponent, h, isVNode } from 'vue';

import { getTabKey } from '@vben/runtime/stores';

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
    return () => {
      let key: string;
      try {
        key = getTabKey(props.route);
      } catch (error) {
        console.error(error);
        key = String(props.route.name || props.route.path);
      }

      // 缓存仅由外层标签渲染器持有，避免每层祖先按叶路由重复建立缓存。
      if (!props.component) return null;
      return isVNode(props.component)
        ? cloneVNode(props.component, { key })
        : h(props.component as Component | string, { key });
    };
  },
});
