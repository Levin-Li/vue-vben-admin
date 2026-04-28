<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Spin } from 'ant-design-vue';

const route = useRoute();
const router = useRouter();

const errorMessage = ref('');
const iframeSrc = ref('');
const loading = ref(true);

const resourceName = computed(() => {
  if (typeof route.meta.crudResource === 'string' && route.meta.crudResource) {
    return route.meta.crudResource;
  }

  if (typeof route.params.resource === 'string' && route.params.resource) {
    return route.params.resource;
  }

  return route.path.replace('/clob/V1/', '').split('/')[0] || '';
});

const routeTitle = computed(() => {
  const title = String(route.meta.title || '').trim();
  if (title && title !== '后台页面') {
    return title;
  }

  return resourceName.value || '通用管理';
});

function getFallbackIframeSrc() {
  const backendIframeSrc = (route.meta as Record<string, unknown>)
    .backendIframeSrc;

  if (typeof backendIframeSrc === 'string' && backendIframeSrc) {
    return backendIframeSrc;
  }

  return resourceName.value
    ? `/admin/m/clob/V1/${resourceName.value}`
    : '/admin';
}

function findPreferredRouteName() {
  const currentPath = route.path;
  const currentName = route.name;
  const currentResource = resourceName.value.toLowerCase();

  const matchedRoute = router.getRoutes().find((item) => {
    if (item.name === currentName) {
      return false;
    }

    if (item.path === currentPath) {
      return true;
    }

    return (
      currentResource &&
      String(item.meta?.crudResource || '').toLowerCase() === currentResource
    );
  });

  if (!matchedRoute?.name) {
    return '';
  }

  return String(matchedRoute.name);
}

async function loadPage() {
  loading.value = true;
  errorMessage.value = '';
  iframeSrc.value = '';

  try {
    const preferredRouteName = findPreferredRouteName();
    if (preferredRouteName) {
      await router.replace({
        hash: route.hash,
        name: preferredRouteName,
        query: route.query,
      });
      return;
    }

    const resource = resourceName.value;

    if (!resource) {
      iframeSrc.value = '/admin';
      return;
    }

    iframeSrc.value = getFallbackIframeSrc();
  } catch (error) {
    console.error(error);
    errorMessage.value = '加载页面定义失败，已回退到后台页面。';
    iframeSrc.value = getFallbackIframeSrc();
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.fullPath,
  () => {
    loadPage();
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <Page :description="errorMessage" :title="routeTitle">
    <div class="rounded-2xl bg-white p-4">
      <Alert
        v-if="errorMessage"
        :message="errorMessage"
        class="mb-4"
        show-icon
        type="warning"
      />
      <Spin :spinning="loading">
        <iframe
          :src="iframeSrc"
          class="h-[calc(100vh-260px)] min-h-[680px] w-full rounded-xl border-0"
        ></iframe>
      </Spin>
    </div>
  </Page>
</template>
