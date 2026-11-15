import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { buildCrudQueryItems } from '@levin/admin-framework/framework-commons/shared/crud-query-items';
import { resolveDetailFields } from '@levin/admin-framework/framework-commons/shared/detail-display';
import { describe, expect, it, vi } from 'vitest';

import { importExportTemplateService } from '../../api/import-export-template-service';
import { memberUserService } from '../../api/member-user-service';
import { noticeProcessLogService } from '../../api/notice-process-log-service';
import { openAreaService } from '../../api/open-area-service';
import { payOrderService } from '../../api/pay-order-service';
import { importExportTemplatePageCrudConfig } from '../import-export-template/config';
import { inboxPageCrudConfig } from '../inbox/config';
import { legalSubjectPageCrudConfig } from '../legal-subject/config';
import { memberUserPageCrudConfig } from '../member-user/config';
import { noticeProcessLogPageCrudConfig } from '../notice-process-log/config';
import { openAreaPageCrudConfig } from '../open-area/config';
import { partnerCommonFields } from '../partner/config';
import { payOrderPageCrudConfig } from '../pay-order/config';

const identity = vi.hoisted(() => ({ userInfo: {} }));
vi.mock('@vben/runtime/stores', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vben/runtime/stores')>()),
  useUserStore: () => identity,
}));

// 每个标准接口显式绑定页面字段与实际列表服务。
const standardScopes = [
  [importExportTemplatePageCrudConfig, importExportTemplateService],
  [memberUserPageCrudConfig, memberUserService],
  [noticeProcessLogPageCrudConfig, noticeProcessLogService],
  [openAreaPageCrudConfig, openAreaService],
  [payOrderPageCrudConfig, payOrderService],
] as const;

function detailFields(config: CrudPageConfig, record: Record<string, unknown>) {
  return resolveDetailFields(
    record,
    [...config.fields, ...(config.detailExtraFields || [])],
    undefined,
    false,
  ).map((field) => field.key);
}

describe('标准 CRUD 的组织归属视图', () => {
  it.each(standardScopes)('配置组织查询、新增、列表和详情视图', (config) => {
    const orgField = config.fields.find((field) => field.key === 'orgId');
    expect(orgField).toMatchObject({
      search: true,
      table: true,
      type: 'org-tree-select',
    });
    expect(orgField?.form).not.toBe(false);
    expect(orgField?.formCreate).not.toBe(false);
    const queryFields = config.fields.filter((field) => field.search);
    expect(buildCrudQueryItems(queryFields).map((item) => item.key)).toContain(
      'orgId',
    );
    const record = { orgId: 'dept-a', orgName: '部门甲' };
    expect(orgField?.tableValue?.(record)).toBe('部门甲');
    expect(orgField?.tableValue?.({ orgId: 'dept-a' })).toBe('dept-a');
    expect(detailFields(config, record)).toContain('orgId');
  });

  it.each(standardScopes)(
    '列表提交选定组织及已授权租户',
    async (_, service) => {
      identity.userInfo = { isPlatformUser: true };
      const get = vi.fn();
      const list = service.list.bind({ get } as never);
      await list({ orgId: 'dept-a', tenantId: 'tenant-a' });
      expect(get).toHaveBeenCalledWith('list', {
        params: {
          orgId: 'dept-a',
          orgIdList: ['dept-a'],
          tenantId: 'tenant-a',
        },
      });

      // 租户用户的归属由服务端注入，显式的已有组织范围保持原值。
      identity.userInfo = { tenantId: 'current-tenant' };
      const orgIdList = ['dept-a', 'dept-b'];
      await list({ orgId: 'dept-a', orgIdList, tenantId: 'tenant-a' });
      expect(get).toHaveBeenLastCalledWith('list', {
        params: { orgId: 'dept-a', orgIdList },
      });
    },
  );

  it('收件箱只在列表和详情读取实际受理组织', () => {
    const record = { orgId: 'desk-a', orgName: '受理组' };
    const orgField = inboxPageCrudConfig.fields.find(
      (field) => field.key === 'orgId',
    );
    expect(inboxPageCrudConfig).toMatchObject({
      allowCreate: false,
      allowEdit: false,
    });
    expect(orgField).toMatchObject({ form: false, search: true, table: true });
    expect(orgField?.tableValue?.(record)).toBe('受理组');
    expect(detailFields(inboxPageCrudConfig, record)).toEqual(['orgName']);
  });
});

describe('法律主体及合作关系的租户归属视图', () => {
  it.each([legalSubjectPageCrudConfig.fields, partnerCommonFields])(
    '独立提供平台租户筛选、创建输入和列表列',
    (...fields) => {
      expect(fields.find((field) => field.key === 'tenantId')).toMatchObject({
        disabledOnEdit: true,
        search: true,
        visibleForPlatformUser: true,
      });
      expect(fields.find((field) => field.key === '__tenant')).toMatchObject({
        detail: false,
        form: false,
        table: true,
        type: 'tenant',
        visibleForPlatformUser: true,
      });
    },
  );
});
