import type { Component, VNodeChild } from 'vue';

import { computed, markRaw, onBeforeUnmount, reactive } from 'vue';

export type LayoutHeaderTopAreaName = 'center' | 'right';

export interface LayoutHeaderTopAreaItem {
  class?: unknown;
  component?: Component;
  id?: string;
  order?: number;
  props?: Record<string, unknown>;
  render?: () => VNodeChild;
}

interface LayoutHeaderTopAreaRecord extends LayoutHeaderTopAreaItem {
  id: string;
}

const headerTopAreaItems = reactive<
  Record<LayoutHeaderTopAreaName, LayoutHeaderTopAreaRecord[]>
>({
  center: [],
  right: [],
});

let seed = 0;

function sortItems(items: LayoutHeaderTopAreaRecord[]) {
  return items.toSorted(
    (left, right) => (left.order || 0) - (right.order || 0),
  );
}

export function getLayoutHeaderTopAreaItems(area: LayoutHeaderTopAreaName) {
  return computed(() => sortItems(headerTopAreaItems[area]));
}

export function addLayoutHeaderTopAreaItem(
  area: LayoutHeaderTopAreaName,
  item: LayoutHeaderTopAreaItem,
) {
  const id = item.id || `${area}-${++seed}`;
  removeLayoutHeaderTopAreaItem(area, id);

  headerTopAreaItems[area].push({
    ...item,
    component: item.component ? markRaw(item.component) : undefined,
    id,
  });

  return () => removeLayoutHeaderTopAreaItem(area, id);
}

export function removeLayoutHeaderTopAreaItem(
  area: LayoutHeaderTopAreaName,
  id: string,
) {
  const items = headerTopAreaItems[area];
  const index = items.findIndex((item) => item.id === id);
  if (index >= 0) {
    items.splice(index, 1);
  }
}

export function clearLayoutHeaderTopArea(area: LayoutHeaderTopAreaName) {
  headerTopAreaItems[area].splice(0);
}

export function useLayoutHeaderTopArea(area: LayoutHeaderTopAreaName) {
  const disposers: Array<() => void> = [];

  function add(item: LayoutHeaderTopAreaItem) {
    const dispose = addLayoutHeaderTopAreaItem(area, item);
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
    clear: () => clearLayoutHeaderTopArea(area),
    items: getLayoutHeaderTopAreaItems(area),
    remove: (id: string) => removeLayoutHeaderTopAreaItem(area, id),
  };
}
