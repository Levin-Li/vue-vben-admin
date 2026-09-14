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

  it('保留记录详情，禁止人工创建、编辑和删除', () => {
    expect(pageMeta).toMatchObject({ name: 'AuditReport', title: '审计报告' });
    expect(auditReportPageCrudConfig).toMatchObject({
      apiBase: '/AuditReport',
      allowCreate: false,
      allowEdit: false,
      allowDelete: false,
      allowRetrieve: true,
      defaultQuery: { pageIndex: 1, pageSize: 10 },
      rowActions: [],
    });
  });

  it('标准列表筛选字段来自 QueryAuditReportReq，报告正文不参与查询', () => {
    const keys = auditReportPageCrudConfig.fields
      .filter((field) => field.search)
      .map((field) => field.key);
    expect(keys).toEqual([
      'containsTitle',
      'id',
      'confidentialLevel',
      'targetType',
      'targetId',
      'bizType',
      'bizCategory',
      'gteStartTime',
      'lteEndTime',
      'creator',
      'gteCreateTime',
      'lteCreateTime',
      'tenantId',
    ]);
    expect(keys).not.toContain('content');
  });

  it('标准列表展示 PagingData<AuditReportInfo> 的核心字段', () => {
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
        'id',
        'title',
        'confidentialLevel',
        'targetType',
        'targetId',
        'bizType',
        'bizCategory',
        'startTime',
        'endTime',
        'createTime',
        'enable',
        '__tenant',
      ]),
    );
  });

  it('报告正文保留编辑器声明，但不混入记录详情', () => {
    expect(
      auditReportPageCrudConfig.fields.find((field) => field.key === 'content'),
    ).toMatchObject({ type: 'json', detail: false, fullRow: true, form: false });
    expect(
      auditReportPageCrudConfig.fields.find((field) => field.key === 'editor'),
    ).toMatchObject({ detail: false, form: false });
  });

  it('详情字段与 retrieve 返回的 AuditReportInfo 元数据对齐', () => {
    const fields = auditReportPageCrudConfig.fields;
    const detailKeys = fields
      .filter((field) => field.detail !== false)
      .map((field) => field.key);

    expect(auditReportPageCrudConfig.domainObject).toBe(true);
    expect(detailKeys).toEqual(
      expect.arrayContaining([
        'id',
        'title',
        'confidentialLevel',
        'bizType',
        'bizCategory',
        'targetType',
        'targetId',
        'startTime',
        'endTime',
        'tenantId',
        'orgId',
        'domainId',
        'creator',
        'createTime',
        'lastUpdateTime',
        'orderCode',
        'enable',
        'editable',
        'remark',
        'optimisticLock',
      ]),
    );
    expect(detailKeys).not.toEqual(
      expect.arrayContaining(['content', 'editor', 'tenantName', 'orgName']),
    );
  });
});
