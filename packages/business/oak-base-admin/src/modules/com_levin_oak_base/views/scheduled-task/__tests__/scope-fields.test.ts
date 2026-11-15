import { describe, expect, it, vi } from 'vitest';

import { scheduledLogService } from '../../../api/scheduled-log-service';
import { scheduledTaskService } from '../../../api/scheduled-task-service';
import { tenantSiteService } from '../../../api/tenant-site-service';
import { scheduledLogPageCrudConfig } from '../../scheduled-log/config';
import { tenantSitePageCrudConfig } from '../../tenant-site/config';
import { scheduledTaskPageCrudConfig } from '../config';

const actor = vi.hoisted(() => ({
  userInfo: { tenantId: 'tenant-own' },
}));

vi.mock('@vben/runtime/stores', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vben/runtime/stores')>()),
  useUserStore: () => actor,
}));

describe('定时任务、任务日志和租户站点的组织归属', () => {
  it.each([
    ['任务', scheduledTaskPageCrudConfig],
    ['任务日志', scheduledLogPageCrudConfig],
    ['租户站点', tenantSitePageCrudConfig],
  ])('%s 支持选择查询组织并回显接口返回的归属名称', (_name, config) => {
    const field = config.fields.find(({ key }) => key === 'orgId');
    expect(field).toMatchObject({
      type: 'org-tree-select',
      search: true,
      table: true,
    });
    expect(field?.tableValue?.({ orgId: 'org-a', orgName: '研发组织' })).toBe(
      '研发组织',
    );
    expect(field?.tableValue?.({ orgId: 'org-a', orgName: '' })).toBe('org-a');
    expect(field?.tableValue?.({})).toBeUndefined();
  });

  it.each([
    ['任务', scheduledTaskService],
    ['任务日志', scheduledLogService],
    ['租户站点', tenantSiteService],
  ])('%s 把查询组织同步到请求的授权组织列表条件', async (_name, service) => {
    const get = vi
      .spyOn(service as unknown as { get: () => Promise<unknown> }, 'get')
      .mockResolvedValue({ items: [] });

    try {
      await service.list({
        orgId: 'org-a',
        tenantId: 'tenant-other',
        pageIndex: 1,
      });
      expect(get).toHaveBeenCalledWith('list', {
        params: { orgId: 'org-a', orgIdList: ['org-a'], pageIndex: 1 },
      });

      await service.list({ pageIndex: 1 });
      expect(get).toHaveBeenLastCalledWith('list', {
        params: { pageIndex: 1 },
      });
    } finally {
      get.mockRestore();
    }
  });

  it('任务创建允许选择组织，只有超级管理员可以编辑归属', () => {
    const taskOrg = scheduledTaskPageCrudConfig.fields.find(
      ({ key }) => key === 'orgId',
    );
    const logOrg = scheduledLogPageCrudConfig.fields.find(
      ({ key }) => key === 'orgId',
    );

    expect(typeof taskOrg?.disabledOnEdit).toBe('function');
    const disabledOnEdit = taskOrg?.disabledOnEdit;
    if (typeof disabledOnEdit !== 'function') {
      throw new TypeError('定时任务组织字段缺少编辑权限限制');
    }
    expect(disabledOnEdit({ userInfo: { roles: ['R_ORG_ADMIN'] } })).toBe(true);
    expect(disabledOnEdit({ userInfo: { roles: ['R_PLATFORM_SA'] } })).toBe(
      false,
    );
    expect(taskOrg?.form).not.toBe(false);
    expect(taskOrg?.formCreate).not.toBe(false);
    expect(logOrg?.form).toBe(false);
  });
});
