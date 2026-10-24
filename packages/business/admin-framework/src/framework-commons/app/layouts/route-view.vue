<script setup lang="ts">
import { inject, provide, shallowReactive, watch } from 'vue';
import {
  routeLocationKey,
  RouterView,
  routerViewLocationKey,
  useRoute,
} from 'vue-router';

import { getTabKey } from '@vben/runtime/stores';

import { RouteViewRenderer } from './route-view-renderer';

defineOptions({ name: 'RouteView' });

// 外层标签缓存拥有整棵页面树；嵌套路由只消费所属标签的路由快照。
const parentRoute = inject(routerViewLocationKey);
const initialRoute = parentRoute?.value ?? useRoute();
const tabKey = getTabKey(initialRoute);
const tabRoute = shallowReactive({ ...initialRoute });
provide(routeLocationKey, tabRoute);

// 同标签参数变化仍可更新，切换到其它标签时不唤醒失活页及其路由监听。
watch(
  () => parentRoute?.value && { ...parentRoute.value },
  (route) => {
    if (route && getTabKey(route) === tabKey) {
      Object.assign(tabRoute, route);
    }
  },
);
</script>

<template>
  <RouterView v-slot="{ Component, route }" :route="tabRoute">
    <div class="relative h-full min-h-0">
      <RouteViewRenderer :component="Component" :route="route" />
    </div>
  </RouterView>
</template>
