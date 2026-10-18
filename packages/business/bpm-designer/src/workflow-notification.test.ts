import type { WorkflowNode, WorkflowNotification } from './types';

import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import { createTreeDefinition } from './definition-model';
import {
  notificationErrors,
  notificationPlainText,
  notificationPreview,
} from './workflow-notification';
import WorkflowNotificationEditor from './workflow-notification-editor.vue';
import { projectDraftV3ToV2 } from './workflow-tree-version';

function rule(patch: Partial<WorkflowNotification> = {}): WorkflowNotification {
  return {
    event: 'TaskCreated',
    recipient: 'taskCandidates',
    channels: ['Station', 'Sms'],
    title: '{{process.name}}',
    content: '# {{node.name}}\n\n**待办**：{{business.id}}',
    ...patch,
  };
}
function node(notifications = [rule()]): WorkflowNode {
  return { id: 'review', name: '财务复核', type: 'userTask', notifications };
}

describe('流程步骤通知与模板', () => {
  it('固定v3设计可保存并投影人工和自动通知，不丢失配置', () => {
    const definition = createTreeDefinition('expense', '报销审核');
    const automatic = rule({ event: 'NodeEntered', recipient: 'applicant' });
    definition.flowTree.notifications = [automatic];
    expect(projectDraftV3ToV2(definition).nodes[0]?.notifications).toEqual([
      automatic,
    ]);
    expect(notificationErrors(definition.flowTree)).toEqual([]);
    expect(notificationErrors(node())).toEqual([]);
  });
  it('拒绝错误节点事件、受众、重复事件和任意外发渠道', () => {
    expect(
      notificationErrors(node([rule({ event: 'NodeEntered' })])).join(','),
    ).toContain('触发时机');
    expect(
      notificationErrors(node([rule({ event: 'TaskProcessed' })])).join(','),
    ).toContain('接收人');
    expect(notificationErrors(node([rule(), rule()])).join(',')).toContain(
      '重复',
    );
    expect(
      notificationErrors(
        node([rule({ channels: ['http://attacker'] as never })]),
      ).join(','),
    ).toContain('有效通知渠道');
  });
  it('拒绝隐藏业务变量、表达式、HTML、图片和脚本URL', () => {
    for (const content of [
      '{{business.password}}',
      '{{new Date()}}',
      '<script>alert(1)</script>',
      '![远程跟踪](https://example.com/pixel)',
      '[脚本](javascript:alert(1))',
    ]) {
      expect(
        notificationErrors(node([rule({ content })])).length,
      ).toBeGreaterThan(0);
    }
    expect(
      notificationErrors(node([rule({ title: '', channels: [] })])).join(','),
    ).toContain('不能为空');
  });
  it('模板示意只替换固定变量，短信转换为纯文本', () => {
    const content = notificationPreview(rule(), '差旅审核', '财务复核');
    expect(content).toBe('# 财务复核\n\n**待办**：示例记录');
    expect(
      notificationPlainText(`${content}\n- [查看详情](https://example.com)`),
    ).toBe('财务复核\n\n待办：示例记录\n查看详情 (https://example.com)');
  });
  it('示例预览保留与服务端一致的变量转义，短信还原原始标点而非HTML实体', () => {
    const name = '[点击](https://evil.example) A&B <测试> **文本**';
    const content = notificationPreview(
      rule({ content: '{{process.name}}' }),
      name,
      '复核',
    );
    expect(content).toContain(String.raw`\[点击\]\(https://evil\.example\)`);
    expect(notificationPlainText(content)).toBe(name);
    expect(notificationPreview(rule(), name, '复核', 'title')).toBe(name);
  });

  it('链接目标只允许作者填写静态HTTPS地址，变量不能成为目标', () => {
    for (const content of [
      '[查看]({{node.name}})',
      '[查看](https://example.com/{{business.id}})',
      '[查看](http://example.com)',
    ]) {
      expect(notificationErrors(node([rule({ content })])).join(' ')).toContain(
        '静态 HTTPS',
      );
    }
    expect(
      notificationErrors(
        node([rule({ content: '[查看](https://example.com/detail)' })]),
      ),
    ).toEqual([]);
  });

  it('自动步骤显示进入和完成事件，可通过表单新增通知，无需JSON', async () => {
    const editor = mount(WorkflowNotificationEditor, {
      props: {
        node: { id: 'start', name: '开始', type: 'start' },
        processName: '审核',
      },
    });
    await editor.get('button').trigger('click');
    const items = editor.emitted('change')?.[0]?.[0] as WorkflowNotification[];
    expect(items[0]?.event).toBe('NodeEntered');
    await editor.setProps({
      node: { id: 'start', name: '开始', type: 'start', notifications: items },
    });
    expect(editor.get('select[aria-label="通知触发时机"]').text()).toContain(
      '完成步骤时',
    );
    expect(editor.text()).not.toContain('当前待办候选人');
    expect(editor.find('textarea[aria-label="通知正文"]').exists()).toBe(true);
  });
  it('切换人工事件不会留下不支持的候选人受众，已发布配置只读', async () => {
    const editor = mount(WorkflowNotificationEditor, {
      props: { node: node(), processName: '报销审核' },
    });
    await editor
      .get('select[aria-label="通知触发时机"]')
      .setValue('TaskProcessed');
    expect(
      (editor.emitted('change')?.[0]?.[0] as WorkflowNotification[])[0]
        ?.recipient,
    ).toBe('applicant');
    await editor.setProps({ readonly: true });
    expect(editor.find('button').exists()).toBe(false);
    expect(editor.get('textarea').attributes('readonly')).toBeDefined();
    expect(editor.get('fieldset').attributes('disabled')).toBeDefined();
  });
});
