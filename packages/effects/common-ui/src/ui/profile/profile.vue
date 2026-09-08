<script setup lang="ts">
import type { Props } from './types';

import { computed } from 'vue';

import { preferences } from '@vben-core/preferences';
import {
  Card,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  VbenAvatar,
} from '@vben-core/shadcn-ui';

import { Page } from '../../components';

defineOptions({
  name: 'ProfileUI',
});

const props = withDefaults(defineProps<Props>(), {
  title: '关于项目',
  tabs: () => [],
});

const tabsValue = defineModel<string>('modelValue');
const displayName = computed(
  () => props.userInfo?.realName || props.userInfo?.username || '',
);
const secondaryAccount = computed(() => {
  const username = props.userInfo?.username || '';
  return username && username !== displayName.value ? username : '';
});
</script>
<template>
  <Page auto-content-height>
    <div class="flex h-full w-full min-w-0 gap-4">
      <Card class="w-[clamp(220px,22vw,280px)] shrink-0">
        <div
          class="mt-4 flex h-40 flex-col items-center justify-center gap-4 px-4"
        >
          <slot name="avatar" :user-info="userInfo">
            <VbenAvatar
              :src="userInfo?.avatar ?? preferences.app.defaultAvatar"
              class="size-20"
            />
          </slot>
          <span
            class="w-full truncate text-center text-lg font-semibold"
            :title="displayName"
          >
            {{ displayName }}
          </span>
          <span
            v-if="secondaryAccount"
            class="text-foreground/80 w-full truncate text-center text-sm"
            :title="secondaryAccount"
          >
            {{ secondaryAccount }}
          </span>
        </div>
        <Separator class="my-4" />
        <Tabs v-model="tabsValue" orientation="vertical" class="m-4">
          <TabsList class="bg-card grid w-full grid-cols-1">
            <TabsTrigger
              v-for="tab in tabs"
              :key="tab.value"
              :value="tab.value"
              class="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-12 justify-start"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>
      <Card class="min-w-0 flex-1 p-8">
        <slot name="content"></slot>
      </Card>
    </div>
  </Page>
</template>
