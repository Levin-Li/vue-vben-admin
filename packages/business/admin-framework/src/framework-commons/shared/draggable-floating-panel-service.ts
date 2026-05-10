import type { Component, VNodeChild } from 'vue';

import { computed, markRaw, onBeforeUnmount, reactive } from 'vue';

export type DraggableFloatingPanelPlacement =
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'top-center'
  | 'top-left'
  | 'top-right';

export interface DraggableFloatingPanelPosition {
  x: number;
  y: number;
}

export interface DraggableFloatingPanelProps {
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  defaultPlacement?: DraggableFloatingPanelPlacement;
  disabled?: boolean;
  edgePadding?: number;
  name?: string;
  initialPosition?: DraggableFloatingPanelPosition;
  panelClass?: string;
  placementGap?: number;
  placementIndex?: number;
  persist?: boolean;
  storageKey?: string;
  top?: number;
  zIndex?: number | string;
}

export interface DraggableFloatingPanelItem {
  component?: Component;
  id?: string;
  name?: string;
  order?: number;
  panelProps?: DraggableFloatingPanelProps;
  props?: Record<string, unknown>;
  render?: () => VNodeChild;
  scope?: string;
}

export interface DraggableFloatingPanelRecord extends DraggableFloatingPanelItem {
  id: string;
  scope: string;
}

/**
 * Browser-window floating panel registry.
 *
 * Use this when a business module needs a small movable control that floats
 * above the whole admin shell, for example a current-tenant selector, temporary
 * tool panel, or demo marker. The framework root app mounts one global
 * `DraggableFloatingPanelHost`; normal business pages should only register
 * items through `useDraggableFloatingPanels(scope)` or
 * `addDraggableFloatingPanel(item)`.
 *
 * Usage:
 *
 * ```ts
 * const panels = useDraggableFloatingPanels('customer-page');
 *
 * panels.add({
 *   id: 'customer-floating-filter',
 *   name: '客户页浮动筛选器',
 *   component: CustomerFloatingFilter,
 *   order: 10,
 *   panelProps: {
 *     defaultPlacement: 'top-center',
 *     storageKey: 'customer-page:floating-filter',
 *   },
 * });
 * ```
 *
 * Rules:
 * - Use a stable `scope` and `id`; registering the same id in the same scope
 *   replaces the old item. Provide a readable `name` so management surfaces
 *   can identify the panel without parsing the technical id.
 * - The default placement is top-center in the top-level browser viewport.
 *   Multiple panels are offset by `placementGap` to avoid full overlap.
 * - Dragging is only available from the panel's built-in top-left drag handle;
 *   business content inside the panel keeps its own click, input, selection,
 *   and drag events.
 * - Floating panels are collapsible by default. A click on the top-left drag
 *   handle collapses the panel to just the handle; clicking it again expands
 *   the panel. Actual dragging does not toggle the collapsed state.
 * - The panel does not impose a default max width or max height. Business
 *   content should define its own size limits when it needs them.
 * - If the business page is rendered inside an iframe, register the panel in
 *   the host/root admin app when it must float above the whole browser window.
 */
const DEFAULT_SCOPE = 'default';
const floatingPanels = reactive<DraggableFloatingPanelRecord[]>([]);

let seed = 0;

function sortPanels(items: DraggableFloatingPanelRecord[]) {
  return items.toSorted(
    (left, right) => (left.order || 0) - (right.order || 0),
  );
}

export function getDraggableFloatingPanels(scope?: string) {
  return computed(() => {
    return sortPanels(
      scope
        ? floatingPanels.filter((item) => item.scope === scope)
        : floatingPanels,
    );
  });
}

export function addDraggableFloatingPanel(item: DraggableFloatingPanelItem) {
  const scope = item.scope || DEFAULT_SCOPE;
  const id = item.id || `${scope}-${++seed}`;
  removeDraggableFloatingPanel(id, scope);

  floatingPanels.push({
    ...item,
    component: item.component ? markRaw(item.component) : undefined,
    id,
    scope,
  });

  return () => removeDraggableFloatingPanel(id, scope);
}

export function removeDraggableFloatingPanel(
  id: string,
  scope = DEFAULT_SCOPE,
) {
  const index = floatingPanels.findIndex(
    (item) => item.id === id && item.scope === scope,
  );
  if (index >= 0) {
    floatingPanels.splice(index, 1);
  }
}

export function clearDraggableFloatingPanels(scope = DEFAULT_SCOPE) {
  for (let index = floatingPanels.length - 1; index >= 0; index -= 1) {
    if (floatingPanels[index]?.scope === scope) {
      floatingPanels.splice(index, 1);
    }
  }
}

export function useDraggableFloatingPanels(scope = DEFAULT_SCOPE) {
  const disposers: Array<() => void> = [];

  function add(item: Omit<DraggableFloatingPanelItem, 'scope'>) {
    const dispose = addDraggableFloatingPanel({ ...item, scope });
    disposers.push(dispose);
    return dispose;
  }

  onBeforeUnmount(() => {
    for (const dispose of disposers.splice(0)) {
      dispose();
    }
  });

  return {
    add,
    clear: () => clearDraggableFloatingPanels(scope),
    panels: getDraggableFloatingPanels(scope),
    remove: (id: string) => removeDraggableFloatingPanel(id, scope),
  };
}
