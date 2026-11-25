import type { ReportRuntimePage, ReportRuntimeResult } from '../report-runtime';

import { describe, expect, it, vi } from 'vitest';

import { createReportRuntime } from '../report-runtime';

const page: ReportRuntimePage = {
  title: '组织分析',
  layout: 'GRID',
  background: {},
  parameters: [
    {
      key: 'org',
      title: '组织',
      type: 'ORGANIZATION',
      required: true,
      requiredForAll: true,
    },
  ],
  components: ['first', 'second'].map((id) => ({
    id,
    title: id,
    type: 'TABLE',
    columns: ['名称'],
    position: { x: 0, y: 0, width: 6, height: 4 },
  })),
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('报表运行时共享参数', () => {
  it('组织和时间范围变更时所有组件只展示对应条件的结果', async () => {
    const combinedPage = {
      ...page,
      parameters: [
        ...page.parameters,
        { key: 'period', title: '时间范围', type: 'DATE_RANGE' as const, required: true, requiredForAll: true },
      ],
    };
    const old = deferred<ReportRuntimeResult>();
    const query = vi.fn((id: string, params: Readonly<Record<string, string>>) =>
      params.org === 'old'
        ? old.promise
        : Promise.resolve({ rows: [[id, params.org, params.period]], hasMore: false }),
    );
    const runtime = createReportRuntime(combinedPage, query);
    const previous = runtime.refresh({ org: 'old', period: '2026-01-01/2026-01-31' });
    await runtime.refresh({ org: 'new', period: '2026-02-01/2026-02-28' });
    old.resolve({ rows: [['过期数据']], hasMore: false });
    await previous;
    for (const id of ['first', 'second']) {
      expect(runtime.state.components[id]?.result?.rows).toEqual([[id, 'new', '2026-02-01/2026-02-28']]);
    }
    expect(query.mock.calls.filter(([, params]) => params.org === 'new').map(([, params]) => params)).toEqual([
      { org: 'new', period: '2026-02-01/2026-02-28' },
      { org: 'new', period: '2026-02-01/2026-02-28' },
    ]);
  });

  it('条件变更清空旧值，迟到响应不能覆盖新组织的数据', async () => {
    const old = deferred<ReportRuntimeResult>();
    const query = vi.fn(
      (id: string, params: Readonly<Record<string, string>>) =>
        params.org === 'old'
          ? old.promise
          : Promise.resolve({ rows: [[id, params.org]], hasMore: false }),
    );
    const runtime = createReportRuntime(page, query);
    const pending = runtime.refresh({ org: 'old', tenantId: 'forged' });
    expect(runtime.state.components.first?.loading).toBe(true);
    await runtime.refresh({ org: 'new' });
    expect(runtime.state.components.first?.result?.rows).toEqual([
      ['first', 'new'],
    ]);
    expect(query.mock.calls[0]?.[1]).toEqual({ org: 'old' });
    old.resolve({ rows: [['旧数据']], hasMore: false });
    await pending;
    expect(runtime.state.components.first?.result?.rows).toEqual([
      ['first', 'new'],
    ]);
    expect(query).toHaveBeenCalledTimes(4);
  });

  it('缺少必填条件或销毁时清空结果并丢弃在途响应', async () => {
    const delayed = deferred<ReportRuntimeResult>();
    const query = vi.fn(() => delayed.promise);
    const runtime = createReportRuntime(page, query);
    const pending = runtime.refresh({ org: 'one' });
    await runtime.refresh({});
    expect(runtime.state.missingRequired).toBe(true);
    expect(runtime.state.components.first?.result).toBeNull();
    runtime.dispose();
    delayed.resolve({ rows: [['过期']], hasMore: false });
    await pending;
    expect(runtime.state.components.first?.result).toBeNull();
    expect(runtime.state.parameters).toEqual({});
  });

  it('组件失败不保留上一次结果，也不妨碍其他组件', async () => {
    let fail = false;
    const runtime = createReportRuntime(page, async (id) => {
      if (fail && id === 'first') throw new Error('无权访问');
      return { rows: [[id]], hasMore: false };
    });
    await runtime.refresh({ org: 'one' });
    fail = true;
    await runtime.refresh({ org: 'two' });
    expect(runtime.state.components.first).toEqual({
      error: true,
      loading: false,
      result: null,
    });
    expect(runtime.state.components.second?.result?.rows).toEqual([['second']]);
  });

  it('旧条件请求迟到失败不会覆盖新条件的结果和状态', async () => {
    let rejectOld!: (error: Error) => void;
    const old = new Promise<ReportRuntimeResult>((_, reject) => { rejectOld = reject; });
    const runtime = createReportRuntime(page, async (id, params) => params.org === 'old'
      ? old : { rows: [[id, params.org]], hasMore: false });
    const previous = runtime.refresh({ org: 'old' });
    await runtime.refresh({ org: 'new' });
    rejectOld(new Error('旧请求失败'));
    await previous;
    for (const id of ['first', 'second']) {
      expect(runtime.state.components[id]).toEqual({ error: false, loading: false,
        result: { rows: [[id, 'new']], hasMore: false } });
    }
  });

  it('限制并发并在条件变化后停止旧批次尚未发出的请求', async () => {
    const many = {
      ...page,
      components: Array.from({ length: 9 }, (_, index) => ({
        ...page.components[0],
        id: `component${index}`,
        title: `component${index}`,
        type: 'TABLE' as const,
        columns: ['名称'],
        position: { x: 0, y: 0, width: 6, height: 4 },
      })),
    };
    const delayed = deferred<ReportRuntimeResult>();
    const query = vi.fn(
      (_: string, params: Readonly<Record<string, string>>) =>
        params.org === 'old'
          ? delayed.promise
          : Promise.resolve({ rows: [], hasMore: false }),
    );
    const runtime = createReportRuntime(many, query);
    const pending = runtime.refresh({ org: 'old' });
    expect(query).toHaveBeenCalledTimes(4);
    const next = runtime.refresh({ org: 'new' });
    expect(query).toHaveBeenCalledTimes(4);
    expect(runtime.state.components.component0?.result).toBeNull();
    delayed.resolve({ rows: [], hasMore: false });
    await pending;
    await next;
    expect(
      query.mock.calls.filter((call) => call[1].org === 'old'),
    ).toHaveLength(4);
    expect(
      query.mock.calls.filter((call) => call[1].org === 'new'),
    ).toHaveLength(9);
  });
});
