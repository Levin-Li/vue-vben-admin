import {
  buildCrudComplexGroupInitialState,
  buildCrudComplexGroupPayload,
} from '@levin/admin-framework/framework-commons/shared/crud-complex-groups';
import { resolveCrudDataAttrPath } from '@levin/admin-framework/framework-commons/shared/crud-data-attr-access';
import { resolveDetailFields } from '@levin/admin-framework/framework-commons/shared/detail-display';
import {
  getJsonSchemaSourceInput,
  resolveJsonSchemaSource,
} from '@levin/admin-framework/framework-commons/shared/json-schema-source';
import { describe, expect, it, vi } from 'vitest';

import { buildCertificationActionPayload } from '../certification-payload';
import { legalSubjectPageCrudConfig } from '../config';

vi.mock('../../../api/legal-subject-service', () => ({
  legalSubjectService: {},
}));
vi.mock('../../api-module', () => ({
  buildEnumOptionsLoader: () => async () => [],
  confidentialLevelOptionsLoader: async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  tenantOptionsLoader: async () => [],
  userOptionsLoader: async () => [],
  withModuleCrudConfig: (config: any) => config,
}));

describe('法律主体管理页面', () => {
  it('通用扩展信息使用独立分组和 JSON 内容自描述编辑器', () => {
    const field = legalSubjectPageCrudConfig.fields.find(
      (item) => item.key === 'extensionInfo',
    );
    expect(field).toMatchObject({
      jsonSchemaEditor: true,
      jsonSchemaMode: 'popup',
      layoutGroup: 'extension',
      table: false,
      export: false,
    });
    if (!field) throw new Error('缺少法律主体扩展信息字段');
    const source = getJsonSchemaSourceInput(field, {
      '@JsonSchema': JSON.stringify({
        type: 'object',
        properties: { memo: { type: 'string' } },
      }),
      memo: '虚构扩展值',
    });
    expect(resolveJsonSchemaSource(source)?.kind).toBe('inline');
  });

  it('收款账户与开票账号分别回显、提交并按各自字段组授权', () => {
    const config = legalSubjectPageCrudConfig;
    const groups = config.complexGroups;
    const initial = buildCrudComplexGroupInitialState(groups, {
      bankAccount: {
        bankName: '虚构收款银行',
        bankAccountName: '测试主体',
        bankAccount: 'test-account-1',
      },
      invoiceInfo: { bankName: '虚构开票银行', bankAccount: 'test-account-2' },
    });
    expect(initial.flatValues).toMatchObject({
      settlementBankName: '虚构收款银行',
      settlementBankAccount: 'test-account-1',
      invoiceBankAccount: 'test-account-2',
    });
    const payload = buildCrudComplexGroupPayload(
      groups,
      initial.enabled,
      initial.flatValues,
    );
    expect(payload.bankAccount).toMatchObject({
      bankAccount: 'test-account-1',
    });
    expect(payload.invoiceInfo).toMatchObject({
      bankAccount: 'test-account-2',
    });
    expect(
      buildCrudComplexGroupPayload(groups, {}, initial.flatValues),
    ).toEqual({});

    const bankField = config.fields.find(
      (field) => field.key === 'settlementBankAccount',
    );
    const invoiceField = config.fields.find(
      (field) => field.key === 'invoiceBankAccount',
    );
    if (!bankField || !invoiceField) throw new Error('银行字段未配置');
    expect(resolveCrudDataAttrPath(bankField, config)).toBe(
      'bankAccount.bankAccount',
    );
    expect(resolveCrudDataAttrPath(invoiceField, config)).toBe(
      'invoiceInfo.bankAccount',
    );
    expect(bankField).toMatchObject({
      table: false,
      export: false,
      required: true,
    });
  });

  it('分别配置主体方、商务对接部门与负责人，不保留单组织归属', () => {
    const field = (key: string) =>
      legalSubjectPageCrudConfig.fields.find((item) => item.key === key);
    for (const party of ['subject', 'business']) {
      expect(field(`${party}OrgId`)).toMatchObject({ type: 'org-tree-select' });
      expect(field(`${party}UserId`)).toMatchObject({
        type: 'user-tree-select',
      });
    }
    expect(field('orgId')).toBeUndefined();
    expect(field('ownerId')).toBeUndefined();
  });

  it('认证动作不提交旧个人归属参数', () => {
    expect(
      buildCertificationActionPayload({
        id: 'subject-1',
        ownerId: 'user-1',
        tenantId: 'tenant-1',
        _operatorAction: '提交认证',
        optimisticLock: 2,
      }),
    ).toEqual({
      id: 'subject-1',
      tenantId: 'tenant-1',
      _operatorAction: '提交认证',
      remark: '提交认证',
      optimisticLock: 2,
    });
  });
  it('详情只展示命名的业务字段，不重复暴露关联对象或内部传输字段', () => {
    const record = {
      subjectOrgId: 'org-1',
      subjectUserId: 'user-1',
      businessOrgId: 'org-2',
      businessUserId: 'user-2',
      tenantName: '租户',
      subjectOrg: {},
      subjectUser: {},
      businessOrg: {},
      businessUser: {},
      invoiceInfoHash: 'hash',
      shippingInfoHash: 'hash',
      bankAccountHash: 'hash',
      optimisticLock: 1,
      creator: 'creator',
      certificationLog: [],
      supportCertificationEventsByCurrentStatus: [],
      lastStatusTime: '2026-11-01T12:00:00',
      lastStatusDesc: '已审核',
      lastUpdateTime: '2026-11-01T12:00:00',
    };
    const fields = resolveDetailFields(
      record,
      legalSubjectPageCrudConfig.fields,
    );
    expect(fields.map((field) => field.key)).toEqual([
      'subjectOrgId',
      'subjectUserId',
      'businessOrgId',
      'businessUserId',
      'lastStatusTime',
      'lastStatusDesc',
      'lastUpdateTime',
    ]);
    expect(fields.find((field) => field.key === 'lastStatusTime')?.label).toBe(
      '最近状态变更时间',
    );
    expect(fields.find((field) => field.key === 'lastStatusDesc')?.label).toBe(
      '最近状态说明',
    );
    expect(fields.find((field) => field.key === 'lastUpdateTime')?.label).toBe(
      '更新时间',
    );
  });
});
