import { describe, expect, it } from 'vitest';

import { formatPersonalMessageSummary } from '../user-message-summary';

describe('个人消息摘要文本', () => {
  it('工作流去掉作者Markdown标记且保留转义业务值原文', () => {
    const summary =
      '# 通知\n- **财务复核**\n\\[业务名称\\]\\(https://evil\\.example\\) A&B\n[作者详情](https://example.com)';
    expect(
      formatPersonalMessageSummary({ sourceType: 'Workflow', summary }),
    ).toBe('通知\n财务复核\n[业务名称](https://evil.example) A&B\n作者详情');
  });

  it('普通文本消息不推断Markdown，空摘要保留调用方文案', () => {
    expect(
      formatPersonalMessageSummary({
        sourceType: 'Inbox',
        summary: '# **文本** A&B',
      }),
    ).toBe('# **文本** A&B');
    expect(
      formatPersonalMessageSummary(
        { sourceType: 'Workflow' },
        '请查看消息详情',
      ),
    ).toBe('请查看消息详情');
  });
});
