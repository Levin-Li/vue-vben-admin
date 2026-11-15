import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkflowDefinitionService } from '../../../api/workflow-definition-service';
import { createWorkflowDefinitionCrudConfig } from '../config';

const actor = vi.hoisted(() => ({ userInfo: {} as Record<string, unknown> }));

vi.mock('@vben/runtime/stores', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vben/runtime/stores')>()),
  useUserStore: () => actor,
}));

afterEach(() => {
  actor.userInfo = {};
  vi.restoreAllMocks();
});

describe('流程定义列表归属', () => {
  it('仅在查询提供选择器，并按接口结果回显归属组织', () => {
    const config = createWorkflowDefinitionCrudConfig({
      apiService: {},
      businessOptions: [],
    });
    expect(config.allowCreate).toBe(false);
    expect(config.allowEdit).toBe(false);
    expect(config.dataAttrConditionKeys).toEqual(
      expect.arrayContaining(['orgId', 'tenantId']),
    );
    const tenant = config.fields.find(({ key }) => key === 'tenantId');
    const org = config.fields.find(({ key }) => key === 'orgId');
    expect(tenant).toMatchObject({
      form: false,
      search: true,
      visibleForPlatformUser: true,
    });
    expect(org).toMatchObject({
      form: false,
      search: true,
      table: true,
      type: 'org-tree-select',
    });
    expect(org?.tableValue?.({ orgId: 'org-a', orgName: '研发组织' })).toBe(
      '研发组织',
    );
  });

  it.each([
    [{ platformUser: true }, { tenantId: 'tenant-a' }],
    [{ tenantId: 'tenant-a' }, {}],
  ])(
    '仅平台身份可提交租户视角，组织单选同步为范围列表',
    async (user, scope) => {
      actor.userInfo = user;
      const service = new WorkflowDefinitionService();
      const get = vi
        .spyOn(service as unknown as { get: () => Promise<unknown> }, 'get')
        .mockResolvedValue({ items: [] });

      await service.list({
        tenantId: 'tenant-a',
        orgId: 'org-a',
        pageIndex: 1,
      });

      expect(get).toHaveBeenCalledWith('list', {
        params: {
          orgId: 'org-a',
          orgIdList: ['org-a'],
          pageIndex: 1,
          ...scope,
        },
      });
    },
  );
});
