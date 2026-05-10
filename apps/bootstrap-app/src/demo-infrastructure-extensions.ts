import { h } from 'vue';

import {
  addDraggableFloatingPanel,
  addLayoutHeaderExtensionAreaItem,
} from '@levin/admin-framework';

function renderHeaderMarker(title: string, description: string) {
  return h(
    'div',
    {
      'aria-label': `${title}：${description}`,
      class:
        'flex h-7 max-w-[120px] items-center rounded border border-border bg-muted/50 px-2 text-[11px] font-medium text-muted-foreground shadow-sm',
      title: `${title}：${description}`,
    },
    [
      h('span', { class: 'truncate' }, title),
      h('span', { class: 'sr-only' }, description),
    ],
  );
}

function renderFloatingMarker(index: number) {
  return h(
    'div',
    {
      class:
        'rounded border border-primary/30 bg-background px-3 py-2 text-xs text-foreground shadow-lg',
    },
    [
      h(
        'div',
        { class: 'font-semibold text-primary' },
        `浮动定位组件 ${index}`,
      ),
      h(
        'div',
        { class: 'mt-1 text-muted-foreground' },
        'Demo 入口应用通过 addDraggableFloatingPanel 注册',
      ),
    ],
  );
}

export function registerDemoInfrastructureExtensions() {
  addLayoutHeaderExtensionAreaItem('center', {
    id: 'bootstrap-demo-header-center-marker',
    order: 10,
    render: () =>
      renderHeaderMarker(
        '中间顶部组件',
        'Demo 入口应用通过 addLayoutHeaderExtensionAreaItem 注册',
      ),
  });

  addLayoutHeaderExtensionAreaItem('right', {
    id: 'bootstrap-demo-header-right-marker',
    order: 10,
    render: () =>
      renderHeaderMarker(
        '顶部右侧组件',
        'Demo 入口应用通过 addLayoutHeaderExtensionAreaItem 注册',
      ),
  });

  for (const index of [1, 2, 3]) {
    addDraggableFloatingPanel({
      id: `bootstrap-demo-floating-marker-${index}`,
      name: `Demo 浮动定位组件 ${index}`,
      order: 10 + index,
      panelProps: {
        defaultPlacement: 'top-left',
        defaultCollapsed: true,
        edgePadding: 16,
        initialPosition: {
          x: 24,
          y: 116 + (index - 1) * 36,
        },
        persist: false,
      },
      render: () => renderFloatingMarker(index),
    });
  }
}
