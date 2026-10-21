import { getResAuthorizeMeta, getServiceMeta } from '@levin/admin-framework';
import { describe, expect, it } from 'vitest';

import { robotNotifyGroupService } from '../../api/robot-notify-group-service';
import {
  canManageRobotWebhook,
  robotNotifyGroupPageCrudConfig,
} from './config';

describe('机器人通知群页面配置', () => {
  it('基础识别前置、接入独立、维护后置且采用可回落的两列布局', () => {
    const config = robotNotifyGroupPageCrudConfig;
    expect(config.formMaxColumns).toBe(2);
    expect(config.modalWidth).toBe(960);
    expect(config.modalWidthStrict).not.toBe(true);
    const ordered = (group: string) =>
      config.fields
        .filter((field) => field.layoutGroup === group)
        .toSorted(
          (left, right) => Number(left.layoutOrder) - Number(right.layoutOrder),
        )
        .map((field) => field.key);
    expect(ordered('basic')).toEqual(['name', 'bizType', 'tenantId', 'orgId']);
    expect(ordered('connection')).toEqual(['platformType', 'webhookUrl']);
    for (const field of config.fields.filter((field) => field.layoutGroup)) {
      expect(field.layoutGroupTitle).toBeTruthy();
    }
    expect(ordered('maintenance')).toEqual([
      'orgShared',
      'enable',
      'description',
    ]);
    for (const key of ['webhookUrl', 'description']) {
      expect(config.fields.find((field) => field.key === key)?.fullRow).toBe(
        true,
      );
    }
    expect(
      config.fields.find((field) => field.key === 'webhookUrl'),
    ).toMatchObject({
      layoutGroupForceDisplay: true,
      type: 'password',
      detail: false,
      table: false,
      export: false,
    });
  });
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

  it('新增只接受官方 HTTPS Webhook', async () => {
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

  it.each([
    'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test',
    'https://open.feishu.cn/open-apis/bot/v2/hook/test',
    'https://oapi.dingtalk.com/robot/send?access_token=test',
  ])('只填官方地址即可启用文本通知：%s', async (webhookUrl) => {
    const submit = robotNotifyGroupPageCrudConfig.transformSubmit;
    if (!submit) throw new Error('缺少提交转换器');
    const values = {
      name: '文本通知群',
      bizType: 'alarm',
      enable: true,
      webhookUrl,
    };
    expect(await submit(values, null)).toMatchObject(values);
  });

  it('历史平台值不限制文本地址，平台字段说明卡片发送必填', async () => {
    const submit = robotNotifyGroupPageCrudConfig.transformSubmit;
    if (!submit) throw new Error('缺少提交转换器');
    const values = {
      name: '文本通知群',
      bizType: 'alarm',
      platformType: 'FeishuWebhook',
      webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test',
    };
    expect(await submit(values, null)).toMatchObject(values);
    expect(
      robotNotifyGroupPageCrudConfig.fields.find(
        (field) => field.key === 'platformType',
      ),
    ).toMatchObject({
      required: false,
      help: expect.stringContaining('发送卡片时必须选择'),
    });
  });

  it.each([
    'https://qyapi.weixin.qq.com.attacker.example/cgi-bin/webhook/send?key=test',
    'https://user:password@qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test',
    'https://qyapi.weixin.qq.com:8443/cgi-bin/webhook/send?key=test',
    'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test#fragment',
  ])('不选择平台也不能绕过地址安全检查：%s', async (webhookUrl) => {
    const submit = robotNotifyGroupPageCrudConfig.transformSubmit;
    if (!submit) throw new Error('缺少提交转换器');
    await expect(
      Promise.resolve().then(() =>
        submit({ name: '测试群', bizType: 'alarm', webhookUrl }, null),
      ),
    ).rejects.toThrow('官方 HTTPS');
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

  it('待配置记录可以暂缺平台和地址，启用时必须补齐地址', async () => {
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
