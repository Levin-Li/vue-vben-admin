import type { Component, VNodeChild } from 'vue';

import { computed, markRaw, onBeforeUnmount, reactive } from 'vue';

export type DraggableFloatingPanelPlacement =
  | 'top-center'
  | 'top-left'
  | 'top-right';

export interface DraggableFloatingPanelPosition {
  x: number;
  y: number;
}

export interface DraggableFloatingPanelProps {
  defaultPlacement?: DraggableFloatingPanelPlacement;
  disabled?: boolean;
  edgePadding?: number;
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

const DEFAULT_SCOPE = 'default';
const floatingPanels = reactive<DraggableFloatingPanelRecord[]>([]);

let seed = 0;

function sortPanels(items: DraggableFloatingPanelRecord[]) {
  return items.toSorted(
    (left, right) => (left.order || 0) - (right.order || 0),
  );
}

export function getDraggableFloatingPanels(scope = DEFAULT_SCOPE) {
  return computed(() => {
    return sortPanels(floatingPanels.filter((item) => item.scope === scope));
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
