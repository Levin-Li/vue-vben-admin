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
  withModuleCrudConfig: (config: any) => config,
}));

describe('法律主体管理页面', () => {
  it('组织表示添加与管理方，不显示个人归属', () => {
    expect(
      legalSubjectPageCrudConfig.fields.find((field) => field.key === 'orgId'),
    ).toMatchObject({
      label: '添加/管理组织',
      type: 'org-tree-select',
    });
    expect(
      legalSubjectPageCrudConfig.fields.some(
        (field) => field.key === 'ownerId',
      ),
    ).toBe(false);
  });

  it('认证动作不提交旧个人归属参数', () => {
    expect(
      buildCertificationActionPayload({
        id: 'subject-1',
        orgId: 'org-1',
        ownerId: 'user-1',
        tenantId: 'tenant-1',
        _operatorAction: '提交认证',
        optimisticLock: 2,
      }),
    ).toEqual({
      id: 'subject-1',
      orgId: 'org-1',
      tenantId: 'tenant-1',
      _operatorAction: '提交认证',
      remark: '提交认证',
      optimisticLock: 2,
    });
  });
});
