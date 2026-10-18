import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { describe, expect, it, vi } from 'vitest';

import { channelPartnerService } from '../../../api/channel-partner-service';
import { partnerService } from '../../../api/partner-service';
import { supplierPartnerService } from '../../../api/supplier-partner-service';
import { partnerCertificationActions } from '../certification-actions';
import {
  buildPartnerCertificationLog,
  buildPartnerCertificationLogAction,
} from '../certification-log';
import { partnerCommonFields } from '../config';

// 状态由服务端控制，事件不接受普通表单中的目标状态。
describe('合作关系认证', () => {
  it('状态仅展示和查询，不允许普通表单修改', () => {
    expect(
      partnerCommonFields.find(({ key }) => key === 'certificationStatus'),
    ).toMatchObject({
      form: false,
      search: true,
      table: true,
    });
  });

  it('支持事件缺失时关闭按钮，并保留接口权限和状态可见条件', () => {
    for (const action of partnerCertificationActions) {
      expect(action.permission).toBeTruthy();
      expect(action.visibleOn).toContain('certificationStatus');
      expect(action.visible?.({})).toBe(false);
      expect(action.visible?.({ supportEventsByCurrentStatus: [] })).toBe(
        false,
      );
      expect(
        action.visible?.({ supportEventsByCurrentStatus: [action.label] }),
      ).toBe(true);
    }
  });

  it('事件提交记录归属范围、乐观锁和备注，拒绝要求原因', async () => {
    const submit = vi
      .spyOn(partnerService, 'submitCertification')
      .mockResolvedValue({});
    const action = partnerCertificationActions.find(
      ({ displayKey }) => displayKey === 'submitCertification',
    );
    if (!action) throw new Error('缺少提交认证操作');

    await action.handler({
      id: 'p1',
      tenantId: 'tenant-1',
      orgId: 'org-1',
      optimisticLock: 7,
      certificationStatus: 'Certified',
      _operatorAction: '补齐资料',
    });
    expect(submit).toHaveBeenCalledWith({
      id: 'p1',
      tenantId: 'tenant-1',
      orgId: 'org-1',
      optimisticLock: 7,
      remark: '补齐资料',
    });
    expect(
      partnerCertificationActions.find(
        ({ displayKey }) => displayKey === 'rejectCertification',
      )?.reasonRequired,
    ).toBe(true);
    submit.mockRestore();
  });

  it.each([supplierPartnerService, channelPartnerService])(
    '日志沿用当前子类型详情权限并读取已解包的响应',
    async (service) => {
      const retrieve = vi.spyOn(service, 'retrieve').mockResolvedValue({
        actionLog: [
          {
            occurTime: '2026-10-18',
            beforeStatus: 'Draft',
            afterStatus: 'AuditPending',
            action: '提交认证',
          },
        ],
      });
      const loaded = vi.fn();
      const action = buildPartnerCertificationLogAction(service, loaded);

      expect(action.permission).toEqual(
        buildApiMethodPermissions(service, 'retrieve'),
      );
      expect(action.permission).not.toEqual(
        buildApiMethodPermissions(partnerService, 'retrieve'),
      );
      await action.handler({ id: 'p1' });
      expect(retrieve).toHaveBeenCalledWith({ id: 'p1' });
      expect(loaded).toHaveBeenCalledWith([
        expect.objectContaining({ transition: '未审核 → [提交认证] → 审核中' }),
      ]);
      retrieve.mockRestore();
    },
  );

  it('读取失败时不打开日志或复用旧数据', async () => {
    const loaded = vi.fn();
    const action = buildPartnerCertificationLogAction(
      { retrieve: vi.fn().mockRejectedValue(new Error('无权访问')) },
      loaded,
    );

    await expect(action.handler({ id: 'p1' })).rejects.toThrow('无权访问');
    expect(loaded).not.toHaveBeenCalled();
  });

  it('没有日志时保持空态，不回填其它关系日志', () => {
    expect(buildPartnerCertificationLog(undefined)).toEqual([]);
    expect(buildPartnerCertificationLog(null)).toEqual([]);
    expect(buildPartnerCertificationLog([])).toEqual([]);
  });

  it('日志正序展示中文状态并隐藏空白备注', () => {
    const logs = buildPartnerCertificationLog([
      {
        occurTime: '2026-10-18T10:01:00',
        operator: '审核员',
        beforeStatus: 'AuditPending',
        afterStatus: 'Certified',
        action: '认证通过',
        remark: '  ',
      },
      {
        occurTime: '2026-10-18T10:00:00',
        operator: '经办人',
        beforeStatus: 'Draft',
        afterStatus: 'AuditPending',
        action: '提交认证',
        remark: '材料齐全',
      },
    ]);

    expect(logs[0]).toMatchObject({
      operator: '经办人',
      transition: '未审核 → [提交认证] → 审核中',
      remark: '材料齐全',
    });
    expect(logs[1]).toMatchObject({
      operator: '审核员',
      transition: '审核中 → [认证通过] → 已认证',
    });
    expect(logs[1]?.remark).toBeUndefined();
  });
});
