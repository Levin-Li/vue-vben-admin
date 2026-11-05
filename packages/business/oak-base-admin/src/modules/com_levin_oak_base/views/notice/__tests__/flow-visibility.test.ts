import { evaluateCrudVisibleOn } from '@levin/admin-framework/framework-commons/shared/crud-visible-on';
import { describe, expect, it } from 'vitest';

import { articleChannelPageCrudConfig } from '../../article-channel/config';
import { articlePageCrudConfig } from '../../article/config';
import { simpleApiPageCrudConfig } from '../../simple-api/config';
import { simpleFormPageCrudConfig } from '../../simple-form/config';
import { simplePagePageCrudConfig } from '../../simple-page/config';
import { noticePageCrudConfig } from '../config';

describe('流程状态和公告动作', () => {
  it('流程状态仅用于展示和查询，不进入新增编辑表单', () => {
    for (const config of [
      articlePageCrudConfig,
      articleChannelPageCrudConfig,
      simpleApiPageCrudConfig,
      simpleFormPageCrudConfig,
      simplePagePageCrudConfig,
    ]) {
      expect(
        config.fields.find((field) => field.key === 'status'),
      ).toMatchObject({ form: false, table: true });
    }
  });

  it.each([
    ['editVisibleOn', '编辑'],
    ['deleteVisibleOn', '删除'],
  ] as const)('%s 对缺失事件或错误状态关闭', (key, event) => {
    const rule = noticePageCrudConfig[key];
    expect(evaluateCrudVisibleOn(rule, { status: 'Draft' }, {})).toBe(false);
    expect(
      evaluateCrudVisibleOn(
        rule,
        { status: 'Draft', supportEventsByCurrentStatus: [event] },
        {},
      ),
    ).toBe(true);
    expect(
      evaluateCrudVisibleOn(
        rule,
        { status: 'Published', supportEventsByCurrentStatus: [event] },
        {},
      ),
    ).toBe(false);
  });

  it.each([
    ['提交审核', 'Draft', 'Published'],
    ['审核拒绝', 'AuditPending', 'Draft'],
    ['审核通过', 'AuditPending', 'Draft'],
    ['发布', 'Approved', 'Published'],
    ['下线', 'Published', 'Draft'],
    ['存档', 'Offline', 'Published'],
  ])('%s 同时要求服务端事件和状态满足条件', (label, allowed, denied) => {
    const action = noticePageCrudConfig.rowActions?.find(
      (item) => item.label === label,
    );
    if (!action || !action.visible)
      throw new Error(`缺少公告动作配置：${label}`);
    expect(action.visible({ status: allowed })).toBe(false);
    expect(
      action.visible({ status: allowed, supportEventsByCurrentStatus: [] }),
    ).toBe(false);
    expect(
      action.visible({
        status: allowed,
        supportEventsByCurrentStatus: [label],
      }),
    ).toBe(true);
    expect(
      evaluateCrudVisibleOn(action.visibleOn, { status: allowed }, {}),
    ).toBe(true);
    expect(
      evaluateCrudVisibleOn(action.visibleOn, { status: denied }, {}),
    ).toBe(false);
  });
});
