import { toRaw } from 'vue';

// 文件内容不能同步读取；保留原始文件身份，避免同名同大小的新文件被误判为原值。
const fileIdentities = new WeakMap<object, number>();
let nextFileIdentity = 0;

/** 保存独立业务值快照，忽略对象键顺序，保留数组顺序和空值差异。 */
export function snapshotCrudFormValues(
  values: Record<string, unknown>,
  jsonKeys: ReadonlySet<string> = new Set(),
): string {
  function normalize(value: unknown): unknown {
    if (value === undefined) return ['undefined'];
    if (value === null || typeof value !== 'object')
      return [typeof value, String(value)];

    const raw = toRaw(value);
    if (raw instanceof Date) return ['date', raw.getTime()];
    if (typeof Blob !== 'undefined' && raw instanceof Blob) {
      if (!fileIdentities.has(raw)) fileIdentities.set(raw, ++nextFileIdentity);
      return ['file', fileIdentities.get(raw)];
    }
    if (Array.isArray(raw))
      return ['array', raw.map((item) => normalize(item))];
    // 日期控件的 Dayjs 等值对象按其序列化业务值比较，排除实例内部状态。
    if ('toJSON' in raw && typeof raw.toJSON === 'function')
      return ['serialized', normalize(raw.toJSON())];
    return [
      'object',
      Object.keys(raw)
        .toSorted()
        .map((key) => [key, normalize((raw as Record<string, unknown>)[key])]),
    ];
  }

  // 仅明确声明为 JSON 的字段解析结构；普通文本不擅自去空白或转换类型。
  const businessValues = Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      if (jsonKeys.has(key) && typeof value === 'string') {
        try {
          return [key, JSON.parse(value)];
        } catch {
          // 未完成的 JSON 输入仍按原文本记录，不能吞掉修改。
        }
      }
      return [key, value];
    }),
  );
  return JSON.stringify(normalize(businessValues));
}
