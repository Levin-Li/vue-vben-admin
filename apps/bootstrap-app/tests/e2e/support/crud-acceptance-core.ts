export interface CrudAcceptanceRun {
  /** 仅用于本次测试数据的稳定标记；删除和清理必须依赖它定位记录。 */
  readonly id: string;
  readonly startedAt: Date;
  value(label: string): string;
}

export interface CrudCreatedRecord {
  /** 后续编辑、删除和失败兜底清理使用的页面级记录定位信息。 */
  key: string;
  /** 页面可见的当前定位值；更新后允许替换，key 仍保持 run-id 标记。 */
  label: string;
}

export interface CrudLifecycleAdapter<PageType = unknown> {
  open(page: PageType, run: CrudAcceptanceRun): Promise<void>;
  create(page: PageType, run: CrudAcceptanceRun): Promise<CrudCreatedRecord>;
  update(
    page: PageType,
    record: CrudCreatedRecord,
    run: CrudAcceptanceRun,
  ): Promise<void>;
  delete(
    page: PageType,
    record: CrudCreatedRecord,
    run: CrudAcceptanceRun,
  ): Promise<void>;
  /** 只能清理本次 run.id 标记的记录。 */
  cleanup?(
    page: PageType,
    record: CrudCreatedRecord,
    run: CrudAcceptanceRun,
  ): Promise<void>;
}

function runSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createCrudAcceptanceRun(workerIndex = 0): CrudAcceptanceRun {
  const id = `e2e-crud-w${workerIndex}-${runSuffix()}`;

  return {
    id,
    startedAt: new Date(),
    value(label: string) {
      const normalizedLabel = label.trim().replaceAll(/\s+/g, '-').slice(0, 24);
      return `${normalizedLabel || 'record'}-${id}`;
    },
  };
}

export function assertRunScoped(value: string, run: CrudAcceptanceRun): void {
  if (!value.includes(run.id)) {
    throw new Error(
      `拒绝清理非本次验收数据：记录标识必须包含测试标记 ${run.id}`,
    );
  }
}

export async function exerciseCrudLifecycle<PageType>(
  page: PageType,
  adapter: CrudLifecycleAdapter<PageType>,
  run: CrudAcceptanceRun,
): Promise<void> {
  let createdRecord: CrudCreatedRecord | undefined;
  let deleted = false;
  let failure: unknown;

  try {
    await adapter.open(page, run);
    createdRecord = await adapter.create(page, run);
    assertRunScoped(createdRecord.key, run);
    await adapter.update(page, createdRecord, run);
    await adapter.delete(page, createdRecord, run);
    deleted = true;
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    if (createdRecord && !deleted && adapter.cleanup) {
      assertRunScoped(createdRecord.key, run);
      try {
        await adapter.cleanup(page, createdRecord, run);
      } catch (cleanupError) {
        if (!failure) {
          throw cleanupError;
        }
        console.error('CRUD 验收清理失败，保留原始失败：', cleanupError);
      }
    }
  }
}
