export interface AdminSessionInitializer {
  clear: () => void;
  load: () => Promise<void>;
}

type Entry = AdminSessionInitializer & { pending?: Promise<void> };
const entries = new Map<string, Entry>();
let active = false;
let generation = 0;

function initialize(id: string, entry: Entry) {
  if (entry.pending) return entry.pending;
  const epoch = generation;
  entry.pending = Promise.resolve()
    .then(() => {
      if (active && generation === epoch && entries.get(id) === entry)
        return entry.load();
    })
    .catch((error) => {
      if (active && generation === epoch)
        console.warn(`会话共享目录初始化失败：${id}`, error);
    });
  return entry.pending;
}

/** 模块登记可选目录；页面消费结果，不负责重新触发初始化。 */
export function registerAdminSessionInitializer(
  id: string,
  initializer: AdminSessionInitializer,
) {
  const previous = entries.get(id);
  previous?.clear();
  const entry: Entry = { ...initializer };
  entries.set(id, entry);
  if (active) void initialize(id, entry);
  return () => {
    if (entries.get(id) !== entry) return;
    entries.delete(id);
    entry.clear();
  };
}

/** 登录/刷新恢复后执行一次；重复调用复用在途和失败结果。 */
export async function initializeAdminSession() {
  active = true;
  await Promise.all([...entries].map(([id, entry]) => initialize(id, entry)));
}

/** 先清理结果再结束会话；资源自身必须以世代检查丢弃迟到响应。 */
export function clearAdminSession() {
  active = false;
  generation++;
  for (const entry of entries.values()) {
    entry.pending = undefined;
    entry.clear();
  }
}
