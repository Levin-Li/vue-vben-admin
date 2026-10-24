/** 每个列表独立保存游标；页码只表示已经实际访问的页。 */
export interface CrudCursorState {
  cursors: Array<string | undefined>;
  hasMore: boolean;
  index: number;
  nextCursor?: string;
  queryKey?: string;
}

export function createCrudCursorState(): CrudCursorState {
  return { cursors: [undefined], index: 0, hasMore: false };
}

/** 分页参数不属于筛选条件；排序与范围变化都必须重新读取首页。 */
export function prepareCrudCursor(
  state: CrudCursorState,
  query: Record<string, unknown>,
) {
  const queryKey = JSON.stringify(
    Object.entries(query)
      .filter(
        ([key]) => !['cursor', 'pageIndex', 'pageSize', 'size'].includes(key),
      )
      .toSorted(([left], [right]) => left.localeCompare(right)),
  );
  if (state.queryKey !== queryKey) {
    Object.assign(state, createCrudCursorState(), {
      queryKey,
      nextCursor: undefined,
    });
  }
  return state.cursors[state.index];
}

/** 服务端必须同时声明还有数据并给出新游标，才允许前进。 */
export function acceptCrudCursor(
  state: CrudCursorState,
  result: { hasMore?: boolean; nextCursor?: unknown },
) {
  const nextCursor =
    typeof result.nextCursor === 'string' && result.nextCursor.trim()
      ? result.nextCursor
      : undefined;
  state.nextCursor = nextCursor;
  state.hasMore =
    result.hasMore === true &&
    Boolean(nextCursor) &&
    nextCursor !== state.cursors[state.index];
}

export function moveCrudCursor(
  state: CrudCursorState,
  direction: 'next' | 'previous',
) {
  if (direction === 'previous') {
    if (state.index === 0) return false;
    state.index -= 1;
  } else {
    if (!state.hasMore || !state.nextCursor) return false;
    state.cursors.splice(state.index + 1, Infinity, state.nextCursor);
    state.index += 1;
  }
  state.hasMore = false;
  state.nextCursor = undefined;
  return true;
}
