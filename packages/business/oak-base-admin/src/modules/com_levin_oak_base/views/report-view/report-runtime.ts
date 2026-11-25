import type {
  ReportComponent,
  ReportGradient,
  ReportParameter,
} from '../../api/report-definition-management-service';

import { reactive } from 'vue';

/** 运行页只需要展示元数据，不能包含数据集关联或服务端查询配置。 */
export interface ReportRuntimePage {
  global?: boolean;
  background: { color?: string; gradient?: ReportGradient; image?: string };
  components: Array<
    Pick<ReportComponent, 'background' | 'id' | 'position' | 'title' | 'tone' | 'showTable' | 'type'> & {
      columns: string[];
      formats?: Array<{ kind: 'MONEY' | 'PLAIN' | 'QUANTITY'; unit?: null | string }>;
    }
  >;
  layout: 'CANVAS' | 'GRID';
  parameters: ReportParameter[];
  title: string;
}

export interface ReportRuntimeResult {
  hasMore: boolean;
  rows: unknown[][];
}

export type ReportRuntimeQuery = (
  componentId: string,
  parameters: Readonly<Record<string, string>>,
) => Promise<ReportRuntimeResult>;

export interface ReportComponentState {
  error: boolean;
  loading: boolean;
  result: null | ReportRuntimeResult;
}

/** 运行时状态仅管理展示；权限与参数范围由服务端每次查询检查。 */
export function createReportRuntime(
  page: ReportRuntimePage,
  query: ReportRuntimeQuery,
) {
  const state = reactive({
    components: {} as Record<string, ReportComponentState>,
    missingRequired: false,
    parameters: {} as Record<string, string>,
  });
  const allowed = new Set(page.parameters.map((parameter) => parameter.key));
  let generation = 0;
  let disposed = false;
  let active = 0;
  let waiters: Array<() => void> = [];

  function wake() {
    const pending = waiters;
    waiters = [];
    pending.forEach((resolve) => resolve());
  }

  function clear() {
    generation += 1;
    wake();
    state.components = Object.fromEntries(
      page.components.map(({ id }) => [
        id,
        { error: false, loading: false, result: null },
      ]),
    );
  }

  /** 替换参数后立即清除旧数据，所有组件都使用同一份不可变参数快照。 */
  async function refresh(parameters: Readonly<Record<string, string>>) {
    if (disposed) return;
    clear();
    const current = generation;
    const snapshot: Record<string, string> = {};
    for (const [key, value] of Object.entries(parameters)) {
      if (allowed.has(key) && typeof value === 'string' && value.trim() !== '')
        snapshot[key] = value;
    }
    state.parameters = { ...snapshot };
    state.missingRequired = page.parameters.some(
      (parameter) => parameter.required && !snapshot[parameter.key],
    );
    if (state.missingRequired) return;
    const frozen = Object.freeze(snapshot);
    let next = 0;
    // 限制并发，避免一个包含大量组件的页面同时打满服务。
    async function worker() {
      while (next < page.components.length) {
        if (disposed || current !== generation) return;
        const component = page.components[next++];
        if (!component) return;
        const target = state.components[component.id];
        if (!target) return;
        target.loading = true;
        // 不同参数版本共用同一窗口，旧请求尚未结束时不能超过服务端用户配额。
        while (true) {
          if (disposed || current !== generation) return;
          if (active < 4) break;
          await new Promise<void>((resolve) => waiters.push(resolve));
        }
        active += 1;
        try {
          const result = await query(component.id, frozen);
          if (!disposed && current === generation) target.result = result;
        } catch {
          if (!disposed && current === generation) target.error = true;
        } finally {
          active -= 1;
          wake();
          if (!disposed && current === generation) target.loading = false;
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(4, page.components.length) }, () =>
        worker(),
      ),
    );
  }

  /** 上下文变化或页面销毁时调用，迟到的请求不再写入状态。 */
  function dispose() {
    clear();
    disposed = true;
    wake();
    state.parameters = {};
    state.missingRequired = false;
  }

  clear();
  return { state, refresh, dispose };
}
