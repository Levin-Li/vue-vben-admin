import { getResAuthorizeMeta, getServiceMeta } from '@levin/admin-framework';
import { describe, expect, it } from 'vitest';

import { robotNotifyGroupService } from '../../api/robot-notify-group-service';
import {
  canManageRobotWebhook,
  robotNotifyGroupPageCrudConfig,
} from './config';

describe('机器人通知群页面配置', () => {
  it('属于基础配置资源且凭据只在密码输入中使用', () => {
    expect(getServiceMeta(robotNotifyGroupService).type).toBe(
      '业务数据-机器人通知群',
    );
    expect(
      getResAuthorizeMeta(
        robotNotifyGroupService.create as Parameters<
          typeof getResAuthorizeMeta
        >[0],
      ).action,
    ).toBe('新增');
    expect(
      getResAuthorizeMeta(
        robotNotifyGroupService.update as Parameters<
          typeof getResAuthorizeMeta
        >[0],
      ).action,
    ).toBe('更新');
    expect(
      robotNotifyGroupPageCrudConfig.fields.find(
        (field) => field.key === 'webhookUrl',
      ),
    ).toMatchObject({
      detail: false,
      export: false,
      maxLength: 768,
      search: false,
      table: false,
      type: 'password',
    });
  });

  it('新增只接受所选平台的 HTTPS Webhook', async () => {
    const submit = robotNotifyGroupPageCrudConfig.transformSubmit;
    expect(submit).toBeTypeOf('function');
    if (!submit) return;
    const base = {
      name: '  告警群  ',
      bizType: '  alarm  ',
      platformType: 'WeComWebhook',
    };
    await expect(
      Promise.resolve().then(() =>
        submit(
          {
            ...base,
            webhookUrl: 'http://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=x',
          },
          null,
        ),
      ),
    ).rejects.toThrow('官方 HTTPS');
    await expect(
      Promise.resolve().then(() =>
        submit({ ...base, webhookUrl: 'https://example.com/hook' }, null),
      ),
    ).rejects.toThrow('官方 HTTPS');
    const valid = await submit(
      {
        ...base,
        webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=x',
      },
      null,
    );
    expect(valid).toMatchObject({ name: '告警群', bizType: 'alarm' });
  });

  it('组织管理员不能仅因共享记录读取或编辑Webhook', () => {
    expect(canManageRobotWebhook({ roleList: [{ code: 'R_ORG_ADMIN' }] })).toBe(
      false,
    );
    expect(canManageRobotWebhook({ roleList: [{ code: 'R_ADMIN' }] })).toBe(
      true,
    );
    expect(
      canManageRobotWebhook({ roleList: [{ code: 'R_PLATFORM_SA' }] }),
    ).toBe(true);
  });

  it('待配置记录可以暂缺平台和地址，启用时必须补齐', async () => {
    const submit = robotNotifyGroupPageCrudConfig.transformSubmit;
    if (!submit) throw new Error('缺少提交转换器');
    const pending = await submit(
      { name: '待配置群', bizType: 'alarm', enable: false },
      null,
    );
    expect(pending).toMatchObject({
      name: '待配置群',
      bizType: 'alarm',
      enable: false,
    });
    await expect(
      Promise.resolve().then(() => submit({ ...pending, enable: true }, null)),
    ).rejects.toThrow('启用通知群前');
  });
});
