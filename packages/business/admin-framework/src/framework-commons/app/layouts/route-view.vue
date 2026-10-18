<script setup lang="ts">
import { RouterView } from 'vue-router';

import { RouteViewRenderer } from './route-view-renderer';

defineOptions({ name: 'RouteView' });
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <div class="relative h-full min-h-0">
      <RouteViewRenderer :component="Component" :route="route" />
    </div>
  </RouterView>
</template>
