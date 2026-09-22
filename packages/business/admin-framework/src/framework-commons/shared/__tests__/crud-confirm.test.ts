import { describe, expect, it } from 'vitest';

import { buildNoFormFlowConfirmConfig } from '../crud-confirm';

describe('简单流程无表单确认', () => {
  it('仅对显式空事件表单生成简洁的流程确认提示', () => {
    expect(
      buildNoFormFlowConfirmConfig({
        eventName: '发布',
        flowFormFields: [],
        recordTitle: '领域 A',
      }),
    ).toEqual({
      enabled: true,
      text: '确认「发布」吗？',
      title: '确认发布',
    });
  });

  it('保留显式跳过确认与已有表单的三态语义', () => {
    expect(
      buildNoFormFlowConfirmConfig({
        confirmText: 'None',
        eventName: '发布',
        flowFormFields: [],
        recordTitle: '领域 A',
      }),
    ).toEqual({ enabled: false });

    for (const flowFormFields of [undefined, null, ['_operatorAction']]) {
      expect(
        buildNoFormFlowConfirmConfig({
          eventName: '审核拒绝',
          flowFormFields,
          recordTitle: '领域 A',
        }),
      ).toEqual({ enabled: false });
    }
  });

  it('优先使用显式确认文案', () => {
    expect(
      buildNoFormFlowConfirmConfig({
        confirmText: '确认执行发布吗？',
        confirmTitle: '发布确认',
        eventName: '发布',
        flowFormFields: [],
        recordTitle: '领域 A',
      }),
    ).toEqual({
      enabled: true,
      text: '确认执行发布吗？',
      title: '发布确认',
    });
  });
});
