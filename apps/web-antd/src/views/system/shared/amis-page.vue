<script lang="ts" setup>
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import 'amis/sdk/sdk.js';

import { amisRequire } from 'amis/sdk/sdk.js';
import { Button, message, Spin } from 'ant-design-vue';

import { requestClient } from '#/api/request';

import ControllerCrudPage from './controller-crud-page.vue';

import 'amis/sdk/rest.js';

import 'amis/lib/themes/default.css';

const route = useRoute();
const localFallbackModules = import.meta.glob('../**/index.vue');

const fallbackMode = ref(false);
const loading = ref(false);
const amisContainer = ref<HTMLElement | null>(null);
let amisMountElement: HTMLElement | null = null;
let amisScoped: null | {
  unmount: () => void;
  updateSchema?: (
    schema: Record<string, any>,
    props?: Record<string, any>,
  ) => void;
} = null;

const backendPath = computed(() => String(route.path || ''));
const fallbackComponent = computed(() => {
  const view = String(route.meta.localFallbackView || '');
  const normalizedView = view.startsWith('/system/')
    ? `../${view.replace('/system/', '')}`
    : '';
  const fallbackLoader = normalizedView
    ? localFallbackModules[normalizedView as keyof typeof localFallbackModules]
    : undefined;

  return (
    (fallbackLoader
      ? defineAsyncComponent(
          fallbackLoader as () => Promise<Record<string, any>>,
        )
      : null) || ControllerCrudPage
  );
});

function isEmptyAmisSchema(schema: unknown) {
  if (!schema) {
    return true;
  }

  if (typeof schema === 'string') {
    return !schema.trim();
  }

  return (
    typeof schema === 'object' &&
    !Array.isArray(schema) &&
    Object.keys(schema as Record<string, unknown>).length === 0
  );
}

function destroyAmisRoot() {
  amisScoped?.unmount();
  amisScoped = null;
  amisMountElement = null;
  if (amisContainer.value) {
    amisContainer.value.replaceChildren();
  }
}

function ensureAmisMountElement() {
  if (!amisContainer.value) {
    throw new Error('AMIS 渲染容器未准备好');
  }

  amisContainer.value.replaceChildren();

  amisMountElement = document.createElement('div');
  amisMountElement.className = 'amis-vben-host';
  amisMountElement.style.minHeight = '680px';
  amisMountElement.style.background = '#ffffff';
  amisMountElement.style.borderRadius = '12px';
  amisContainer.value.append(amisMountElement);

  return amisMountElement;
}

function normalizeAmisApiUrl(url = '') {
  if (!url || /^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith('/com.levin.oak.base/')) {
    return url;
  }

  return url.startsWith('/') ? url : `/${url}`;
}

function buildAmisFetcher() {
  return async (config: {
    config?: Record<string, any>;
    data?: any;
    headers?: Record<string, any>;
    method?: string;
    responseType?: string;
    url: string;
  }) => {
    const method = String(config.method || 'get').toLowerCase();
    const url = normalizeAmisApiUrl(config.url);
    const axiosConfig: Record<string, any> = {
      ...config.config,
      headers: {
        ...config.config?.headers,
        ...config.headers,
      },
    };

    if (url.startsWith('/com.levin.oak.base/')) {
      axiosConfig.baseURL = '';
    }

    if (config.responseType) {
      axiosConfig.responseType = config.responseType;
    }

    try {
      const response =
        method === 'get' || method === 'delete'
          ? await requestClient.request<any>(url, {
              ...axiosConfig,
              method,
              params: config.data,
              responseReturn: 'raw',
            })
          : await requestClient.request<any>(url, {
              ...axiosConfig,
              data: config.data,
              method,
              responseReturn: 'raw',
            });

      return {
        data: response?.data,
        headers: response?.headers,
        status: response?.status || 200,
      };
    } catch (error: any) {
      const responseData = error?.response?.data || error;
      return {
        data: responseData,
        status: error?.response?.status || 500,
      };
    }
  };
}

async function mountAmisSchema(schema: Record<string, any>) {
  await nextTick();

  destroyAmisRoot();
  const mountElement = ensureAmisMountElement();

  const requireAmis =
    typeof amisRequire === 'function'
      ? amisRequire
      : (window as any).amisRequire;

  if (typeof requireAmis !== 'function') {
    throw new Error('AMIS SDK 未正确初始化');
  }

  const amis = requireAmis('amis/embed');
  amisScoped = amis.embed(
    mountElement,
    schema,
    {
      data: {
        route: {
          meta: route.meta,
          path: route.path,
          query: route.query,
        },
      },
    },
    {
      fetcher: buildAmisFetcher(),
      getModalContainer: () => mountElement,
      session: `amis:${backendPath.value}`,
      theme: 'default',
    },
  );
}

async function loadAmisPage() {
  loading.value = true;
  fallbackMode.value = false;
  destroyAmisRoot();

  try {
    const data = await requestClient.get<any>('/amis/ui', {
      params: {
        path: backendPath.value,
      },
    });

    if (isEmptyAmisSchema(data)) {
      message.warning('后端 AMIS 页面内容为空，已切换到本地 Vue 页面。');
      fallbackMode.value = true;
      return;
    }

    await mountAmisSchema(typeof data === 'string' ? JSON.parse(data) : data);
  } catch (error: any) {
    message.warning(
      error?.message || '加载后端 AMIS 页面失败，已切换到本地 Vue 页面。',
    );
    fallbackMode.value = true;
  } finally {
    loading.value = false;
  }
}

function openLocalFallback() {
  fallbackMode.value = true;
  destroyAmisRoot();
}

onMounted(loadAmisPage);
onBeforeUnmount(destroyAmisRoot);

watch(
  () => route.fullPath,
  () => {
    void loadAmisPage();
  },
);
</script>

<template>
  <Page auto-content-height content-class="!bg-transparent">
    <Spin :spinning="loading">
      <div>
        <component :is="fallbackComponent" v-if="fallbackMode" />
        <div
          v-else
          ref="amisContainer"
          class="amis-page-host min-h-[680px]"
        ></div>
        <Button
          v-if="!fallbackMode"
          class="mt-4"
          type="link"
          @click="openLocalFallback"
        >
          切换到本地 Vue 页面
        </Button>
      </div>
    </Spin>
  </Page>
</template>

<style scoped>
.amis-page-host {
  background: #f8fafc;
}

.amis-page-host :deep(.amis-routes-wrapper),
.amis-page-host :deep(.amis-scope),
.amis-page-host :deep(.cxd-Page) {
  min-height: 680px;
}
</style>
