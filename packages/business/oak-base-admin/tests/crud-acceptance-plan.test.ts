import { describe, expect, it } from 'vitest';

import {
  CRUD_SPECIAL_OPERATION_FORM_EXCEPTIONS,
  REQUIRED_CRUD_ACCEPTANCE_OPERATIONS,
  validateCrudAcceptancePlan,
} from '../../../../apps/bootstrap-app/tests/e2e/crud-acceptance-plan';
import {
  assertRunScoped,
  exerciseCrudLifecycle,
  type CrudAcceptanceRun,
  type CrudLifecycleAdapter,
} from '../../../../apps/bootstrap-app/tests/e2e/support/crud-acceptance-core';

describe('CRUD 真实验收清单', () => {
  it('仅豁免扩展操作表单，仍要求每页覆盖新增、编辑、删除', () => {
    expect(CRUD_SPECIAL_OPERATION_FORM_EXCEPTIONS).not.toHaveLength(0);

    for (const page of CRUD_SPECIAL_OPERATION_FORM_EXCEPTIONS) {
      expect(
        page.specialOperationException?.excludedOperationLabels.length,
      ).toBeGreaterThan(0);
      expect(page.requiredOperations).toEqual(
        expect.arrayContaining(REQUIRED_CRUD_ACCEPTANCE_OPERATIONS),
      );
    }
  });

  it('拒绝重复资源或缺少标准 CRUD 生命周期的清单', () => {
    expect(() =>
      validateCrudAcceptancePlan([
        {
          requiredOperations: ['create', 'update'],
          resource: 'Demo',
          route: '/clob/V1/Demo',
          title: '示例',
        },
      ]),
    ).toThrow('delete');
  });

  it('失败时只清理本次 run id 标记的记录', async () => {
    const run = {
      id: 'e2e-crud-w0-test-run',
      startedAt: new Date(),
      value: (label: string) => `${label}-e2e-crud-w0-test-run`,
    } satisfies CrudAcceptanceRun;
    const events: string[] = [];
    const adapter: CrudLifecycleAdapter = {
      async cleanup(_page, record) {
        events.push(`cleanup:${record.key}`);
      },
      async create() {
        events.push('create');
        return {
          key: run.value('record'),
          label: '测试记录',
        };
      },
      async delete() {
        events.push('delete');
      },
      async open() {
        events.push('open');
      },
      async update() {
        events.push('update');
        throw new Error('模拟编辑失败');
      },
    };

    await expect(
      exerciseCrudLifecycle({} as any, adapter, run),
    ).rejects.toThrow('模拟编辑失败');
    expect(events).toEqual([
      'open',
      'create',
      'update',
      `cleanup:${run.value('record')}`,
    ]);
    expect(() => assertRunScoped('其它记录', run)).toThrow('拒绝清理');
  });
});
