import type { CrudPageConfig, CrudRowAction } from '@levin/admin-framework/framework-commons/shared/types';

import { describe, expect, it } from 'vitest';

import { articlePageCrudConfig } from '../article/config';
import { articleChannelPageCrudConfig } from '../article-channel/config';
import { noticePageCrudConfig } from '../notice/config';
import { platformDomainPageCrudConfig } from '../platform-domain/config';
import { simpleApiPageCrudConfig } from '../simple-api/config';
import { simpleFormPageCrudConfig } from '../simple-form/config';
import { simplePagePageCrudConfig } from '../simple-page/config';

const flowConfigs: CrudPageConfig[] = [
  articlePageCrudConfig,
  articleChannelPageCrudConfig,
  noticePageCrudConfig,
  simpleApiPageCrudConfig,
  simpleFormPageCrudConfig,
  simplePagePageCrudConfig,
  platformDomainPageCrudConfig,
];
const flowLabels = new Set([
  '提交审核',
  '审核拒绝',
  '审核通过',
  '发布',
  '下线',
  '存档',
]);

describe('简单流程操作表单三态配置', () => {
  it('为无参数事件明确声明空表单，为审核拒绝保留原因输入', () => {
    const flowActions = flowConfigs
      .flatMap((config) => config.rowActions || [])
      .filter((action) => flowLabels.has(action.label));

    for (const action of flowActions) {
      const flowAction = action as CrudRowAction;
      if (flowAction.label === '审核拒绝') {
        expect(flowAction.flowFormFields).toEqual(['_operatorAction']);
        continue;
      }

      expect(flowAction.flowFormFields).toEqual([]);
    }
  });

  it('通知管理页提供发布和接收者展示所需的核心字段', () => {
    const fieldKeys = new Set(
      noticePageCrudConfig.fields.map((field) => field.key),
    );

    expect([...fieldKeys]).toEqual(
      expect.arrayContaining([
        'contentType',
        'level',
        'publishTime',
        'subtitle',
        'title',
      ]),
    );
  });
});
