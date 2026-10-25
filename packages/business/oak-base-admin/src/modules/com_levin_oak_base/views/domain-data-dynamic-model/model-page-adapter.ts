// 公共CRUD允许较大导出分页；领域接口每次最多100条，按同一逻辑页连续读取，禁止跨身份混合。
export async function loadModelCrudPage<T>(
  pageIndex: number,
  pageSize: number,
  fetchPage: (
    page: number,
    size: number,
  ) => Promise<{ items: T[]; total: number }>,
  context: () => string,
): Promise<{ items: T[]; totals: number }> {
  const identity = context();
  const read = async (page: number, size: number) => {
    if (context() !== identity)
      throw new Error('当前身份或数据范围已变化，请重新查询');
    const result = await fetchPage(page, size);
    if (context() !== identity)
      throw new Error('当前身份或数据范围已变化，请重新查询');
    return result;
  };
  const index = Math.max(1, Math.floor(pageIndex || 1));
  const size = Math.max(1, Math.floor(pageSize || 20));
  if (size <= 100) {
    const result = await read(index - 1, size);
    return { items: result.items, totals: result.total };
  }
  const start = (index - 1) * size;
  const items: T[] = [];
  let totals = 0;
  for (let page = Math.floor(start / 100); ; page++) {
    const result = await read(page, 100);
    totals = result.total;
    const offset = page === Math.floor(start / 100) ? start % 100 : 0;
    items.push(...result.items.slice(offset, offset + size - items.length));
    if (
      items.length >= size ||
      (page + 1) * 100 >= totals ||
      result.items.length < 100
    )
      break;
  }
  return { items, totals };
}
