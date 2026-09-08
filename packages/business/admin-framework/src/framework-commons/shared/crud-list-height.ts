import type { CrudPageDisplayConfig } from './types';

/** 当前分页完整展示时，只保留表格横向滚动。 */
export function resolveCrudListHeight(
  list: CrudPageDisplayConfig['list'],
  fullscreen = false,
) {
  const showAllPageRows = list?.showAllPageRows === true;
  return { showAllPageRows, pageScrollable: showAllPageRows && !fullscreen };
}

export function getCrudListScroll(
  showAllPageRows: boolean,
  availableHeight: number,
) {
  return showAllPageRows
    ? { x: 'max-content' }
    : {
        x: 'max-content',
        y: Math.max(
          160,
          Number.isFinite(availableHeight) ? availableHeight : 0,
        ),
      };
}
