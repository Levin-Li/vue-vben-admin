import { resolveDetailFields } from '@levin/admin-framework/framework-commons/shared/detail-display';
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
  it('分别配置主体方、维护方组织与负责人，不保留单组织归属', () => {
    const field = (key: string) =>
      legalSubjectPageCrudConfig.fields.find((item) => item.key === key);
    for (const party of ['subject', 'maintain']) {
      expect(field(`${party}OrgId`)).toMatchObject({ type: 'org-tree-select' });
      expect(field(`${party}UserId`)).toMatchObject({
        type: 'select',
        remoteSearch: true,
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
      maintainOrgId: 'org-2',
      maintainUserId: 'user-2',
      tenantName: '租户',
      subjectOrg: {},
      subjectUser: {},
      maintainOrg: {},
      maintainUser: {},
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
      'maintainOrgId',
      'maintainUserId',
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
