import { defineComponent, h, onErrorCaptured, ref, watch } from 'vue';

export const RouteContentErrorBoundary = defineComponent({
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
