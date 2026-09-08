import { describe, expect, it, vi } from 'vitest';

import { auditReportPageCrudConfig, pageMeta } from '../config';

vi.mock('../../../api/audit-report-service', () => ({
  auditReportService: {},
}));
vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: '80%',
  tenantOptionsLoader: async () => [],
  buildDictOptionsLoader: vi.fn(() => async () => []),
  buildEnumOptionsLoader: () => async () => [],
}));

describe('审计报告只读页面', () => {
  it('正文声明后端编辑器注解且保留只读边界', () => {
    expect(
      auditReportPageCrudConfig.fields.find((field) => field.key === 'content'),
    ).toMatchObject({
      jsonSchemaEditor: true,
      jsonSchema: ':editor',
      form: false,
    });
    expect(auditReportPageCrudConfig.allowEdit).toBe(false);
  });

  it('仅提供查看报告，禁止人工创建、编辑和删除', () => {
    expect(pageMeta).toMatchObject({ name: 'AuditReport', title: '审计报告' });
    expect(auditReportPageCrudConfig).toMatchObject({
      apiBase: '/AuditReport',
      allowCreate: false,
      allowEdit: false,
      allowDelete: false,
      allowRetrieve: true,
      retrieveLabel: '查看报告',
      defaultQuery: { pageIndex: 1, pageSize: 10 },
      rowActions: [],
    });
  });

  it('查询条件来自查询请求，报告正文不参与查询', () => {
    const keys = auditReportPageCrudConfig.fields
      .filter((field) => field.search)
      .map((field) => field.key);
    expect(keys).toEqual([
      'containsTitle',
      'targetType',
      'targetId',
      'bizType',
      'bizCategory',
      'gteStartTime',
      'lteEndTime',
      'tenantId',
    ]);
    expect(keys).not.toContain('content');
  });

  it('对象类型使用字典，列表展示审计窗口和创建时间', () => {
    expect(
      auditReportPageCrudConfig.fields.find(
        (field) => field.key === 'targetType',
      ),
    ).toMatchObject({ type: 'select', loadOptions: expect.any(Function) });
    const columns = auditReportPageCrudConfig.fields
      .filter((field) => field.table)
      .map((field) => field.key);
    expect(columns).toEqual(
      expect.arrayContaining([
        'title',
        'targetType',
        'targetId',
        'startTime',
        'endTime',
        'createTime',
      ]),
    );
  });

  it('详情保留编辑器声明和完整只读 JSON 内容', () => {
    expect(
      auditReportPageCrudConfig.fields.find((field) => field.key === 'content'),
    ).toMatchObject({ type: 'json', detail: true, fullRow: true, form: false });
    expect(
      auditReportPageCrudConfig.fields.find((field) => field.key === 'editor'),
    ).toMatchObject({ form: false });
  });
});
