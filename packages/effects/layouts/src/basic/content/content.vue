<script lang="ts" setup>
import type { VNode } from 'vue';
import type {
  RouteLocationNormalizedLoaded,
  RouteLocationNormalizedLoadedGeneric,
} from 'vue-router';

import { computed, defineComponent, h, onErrorCaptured, ref, watch } from 'vue';
import { RouterView } from 'vue-router';

import { preferences, usePreferences } from '@vben/preferences';
import { getTabKey, storeToRefs, useTabbarStore } from '@vben/stores';

import { IFrameRouterView } from '../../iframe';

defineOptions({ name: 'LayoutContent' });

const tabbarStore = useTabbarStore();
const { keepAlive } = usePreferences();

const { getCachedTabs, getExcludeCachedTabs, renderRouteView } =
  storeToRefs(tabbarStore);

const RouteContentErrorBoundary = defineComponent({
  name: 'RouteContentErrorBoundary',
  props: {
    routeKey: {
      required: true,
      type: String,
    },
  },
  setup(props, { slots }) {
    const error = ref<null | unknown>(null);

    watch(
      () => props.routeKey,
      () => {
        error.value = null;
      },
    );

    onErrorCaptured((capturedError) => {
      error.value = capturedError;
      console.error(capturedError);
      return false;
    });

    return () => {
      if (!error.value) {
        return slots.default?.();
      }

      const message =
        error.value instanceof Error
          ? error.value.message
          : String(error.value || '未知错误');

      return h(
        'div',
        {
          class:
            'border-border bg-card text-foreground m-4 rounded border p-6 shadow-sm',
        },
        [
          h('div', { class: 'text-base font-medium' }, '当前页面渲染失败'),
          h(
            'div',
            { class: 'text-muted-foreground mt-2 text-sm' },
            '该错误已限制在当前页面。切换到其它菜单后页面会重新渲染。',
          ),
          h(
            'pre',
            {
              class:
                'bg-muted mt-4 max-h-40 overflow-auto rounded p-3 text-xs whitespace-pre-wrap',
            },
            message,
          ),
        ],
      );
    };
  },
});

/**
 * 是否使用动画
 */
const getEnabledTransition = computed(() => {
  const { transition } = preferences;
  const transitionName = transition.name;
  return transitionName && transition.enable;
});

// 页面切换动画
function getTransitionName(_route: RouteLocationNormalizedLoaded) {
  // 如果偏好设置未设置，则不使用动画
  const { tabbar, transition } = preferences;
  const transitionName = transition.name;
  if (!transitionName || !transition.enable) {
    return;
  }

  // 标签页未启用或者未开启缓存，则使用全局配置动画
  if (!tabbar.enable || !keepAlive.value) {
    return transitionName;
  }

  // 如果页面已经加载过，则不使用动画
  // if (route.meta.loaded) {
  //   return;
  // }
  // 已经打开且已经加载过的页面不使用动画
  // const inTabs = getCachedTabs.value.includes(route.name as string);

  // return inTabs && route.meta.loaded ? undefined : transitionName;
  return transitionName;
}

/**
 * 转换组件，自动添加 name
 * @param component
 */
function transformComponent(
  component: VNode,
  route: RouteLocationNormalizedLoadedGeneric,
) {
  // 组件视图未找到，如果有设置后备视图，则返回后备视图，如果没有，则抛出错误
  if (!component) {
    console.error(
      'Component view not found，please check the route configuration',
    );
    return undefined;
  }

  const routeName = route.name as string;
  // 如果组件没有 name，则直接返回
  if (!routeName) {
    return component;
  }
  const componentName = (component?.type as any)?.name;

  // 已经设置过 name，则直接返回
  if (componentName) {
    return component;
  }

  // componentName 与 routeName 一致，则直接返回
  if (componentName === routeName) {
    return component;
  }

  // 设置 name
  component.type ||= {};
  (component.type as any).name = routeName;

  return component;
}
</script>

<template>
  <div class="relative h-full">
    <IFrameRouterView />
    <RouterView v-slot="{ Component, route }">
      <Transition
        v-if="getEnabledTransition"
        :name="getTransitionName(route)"
        appear
        mode="out-in"
      >
        <div
          v-if="renderRouteView && Component && !route.meta.iframeSrc"
          class="relative h-full min-h-0"
        >
          <RouteContentErrorBoundary :route-key="getTabKey(route)">
            <component
              :is="transformComponent(Component, route)"
              v-if="!keepAlive"
              :key="getTabKey(route)"
            />
            <KeepAlive
              v-else
              :exclude="getExcludeCachedTabs"
              :include="getCachedTabs"
            >
              <component
                :is="transformComponent(Component, route)"
                :key="getTabKey(route)"
              />
            </KeepAlive>
          </RouteContentErrorBoundary>
        </div>
      </Transition>
      <template v-else>
        <div
          v-if="renderRouteView && Component && !route.meta.iframeSrc"
          class="relative h-full min-h-0"
        >
          <RouteContentErrorBoundary :route-key="getTabKey(route)">
            <component
              :is="transformComponent(Component, route)"
              v-if="!keepAlive"
              :key="getTabKey(route)"
            />
            <KeepAlive
              v-else
              :exclude="getExcludeCachedTabs"
              :include="getCachedTabs"
            >
              <component
                :is="transformComponent(Component, route)"
                :key="getTabKey(route)"
              />
            </KeepAlive>
          </RouteContentErrorBoundary>
        </div>
      </template>
    </RouterView>
  </div>
</template>
