import { defineComponent, h, nextTick, onErrorCaptured, ref, watch } from 'vue';

import { useRefresh } from '@vben/hooks';

import { alert } from '@vben-core/popup-ui';

const ROUTE_RENDER_ERROR_INFO = new Set([
  'async component loader',
  'component update',
  'render function',
  'setup function',
]);

function getRouteContentErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const data = (error as any).response?.data ?? error;
    const message =
      data?.msg ?? data?.detailMsg ?? data?.message ?? data?.error;

    if (message) {
      return String(message);
    }

    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(error);
    }
  }

  return String(error || '未知错误');
}

function shouldCaptureRouteContentError(info: string) {
  return ROUTE_RENDER_ERROR_INFO.has(info);
}

export const RouteContentErrorBoundary = defineComponent({
  name: 'RouteContentErrorBoundary',
  props: {
    routeKey: {
      required: true,
      type: String,
    },
  },
  setup(props, { slots }) {
    const { refresh } = useRefresh();
    const error = ref<null | unknown>(null);
    const confirming = ref(false);

    watch(
      () => props.routeKey,
      () => {
        error.value = null;
        confirming.value = false;
      },
    );

    async function confirmRefreshCurrentRoute() {
      if (confirming.value) {
        return;
      }

      confirming.value = true;
      await nextTick();

      alert({
        confirmText: '确定',
        content: '发生未知错误，点击确定后将刷新当前页面。',
        icon: 'error',
        title: '未知错误',
      })
        .then(async () => {
          await refresh();
        })
        .catch(() => {
          confirming.value = false;
        });
    }

    onErrorCaptured((capturedError, _instance, info) => {
      console.error(capturedError);

      if (!shouldCaptureRouteContentError(info)) {
        return false;
      }

      error.value = capturedError;
      void confirmRefreshCurrentRoute();
      return false;
    });

    return () => {
      if (!error.value) {
        return slots.default?.();
      }

      const message = getRouteContentErrorMessage(error.value);

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

export { getRouteContentErrorMessage, shouldCaptureRouteContentError };
