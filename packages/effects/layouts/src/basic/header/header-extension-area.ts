import type { Component, VNodeChild } from 'vue';

import { computed, markRaw, onBeforeUnmount, reactive } from 'vue';

export type LayoutHeaderExtensionAreaName = 'center' | 'right';

export interface LayoutHeaderExtensionAreaItem {
  class?: unknown;
  component?: Component;
  id?: string;
  order?: number;
  props?: Record<string, unknown>;
  render?: () => VNodeChild;
}

interface LayoutHeaderExtensionAreaRecord extends LayoutHeaderExtensionAreaItem {
  id: string;
}

const headerExtensionAreaItems = reactive<
  Record<LayoutHeaderExtensionAreaName, LayoutHeaderExtensionAreaRecord[]>
>({
  center: [],
  right: [],
});

let seed = 0;

function sortItems(items: LayoutHeaderExtensionAreaRecord[]) {
  return items.toSorted(
    (left, right) => (left.order || 0) - (right.order || 0),
  );
}

export function getLayoutHeaderExtensionAreaItems(
  area: LayoutHeaderExtensionAreaName,
) {
  return computed(() => sortItems(headerExtensionAreaItems[area]));
}

export function addLayoutHeaderExtensionAreaItem(
  area: LayoutHeaderExtensionAreaName,
  item: LayoutHeaderExtensionAreaItem,
) {
  const id = item.id || `${area}-${++seed}`;
  removeLayoutHeaderExtensionAreaItem(area, id);

  headerExtensionAreaItems[area].push({
    ...item,
    component: item.component ? markRaw(item.component) : undefined,
    id,
  });

  return () => removeLayoutHeaderExtensionAreaItem(area, id);
}

export function removeLayoutHeaderExtensionAreaItem(
  area: LayoutHeaderExtensionAreaName,
  id: string,
) {
  const items = headerExtensionAreaItems[area];
  const index = items.findIndex((item) => item.id === id);
  if (index >= 0) {
    items.splice(index, 1);
  }
}

export function clearLayoutHeaderExtensionArea(
  area: LayoutHeaderExtensionAreaName,
) {
  headerExtensionAreaItems[area].splice(0);
}

export function useLayoutHeaderExtensionArea(
  area: LayoutHeaderExtensionAreaName,
) {
  const disposers: Array<() => void> = [];

  function add(item: LayoutHeaderExtensionAreaItem) {
    const dispose = addLayoutHeaderExtensionAreaItem(area, item);
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
    clear: () => clearLayoutHeaderExtensionArea(area),
    items: getLayoutHeaderExtensionAreaItems(area),
    remove: (id: string) => removeLayoutHeaderExtensionAreaItem(area, id),
  };
}
