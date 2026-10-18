import type {
  WorkflowNode,
  WorkflowNodeType,
  WorkflowNotification,
  WorkflowNotificationEvent,
} from './types';

// 目录与服务端封闭契约一致；不提供任意地址、脚本或业务隐藏字段。
export const notificationChannels = [
  { value: 'Station', label: '站内通知' },
  { value: 'Sms', label: '短信（纯文本）' },
  { value: 'Email', label: '邮件' },
  { value: 'WeComWebhook', label: '企业微信机器人' },
  { value: 'DingTalkWebhook', label: '钉钉机器人' },
  { value: 'FeishuWebhook', label: '飞书机器人' },
] as const;
export const notificationVariables = [
  { key: 'process.name', label: '流程名称' },
  { key: 'node.name', label: '步骤名称' },
  { key: 'event.name', label: '事件名称' },
  { key: 'action.name', label: '办理动作' },
  { key: 'business.id', label: '业务记录编号' },
] as const;
export function notificationEvents(type: WorkflowNodeType) {
  return type === 'userTask'
    ? ([
        { value: 'TaskCreated', label: '产生待办时' },
        { value: 'TaskProcessed', label: '完成办理时' },
        { value: 'TaskReminder', label: '待办提醒时' },
        { value: 'TaskDeadline', label: '待办超时时' },
      ] as const)
    : ([
        { value: 'NodeEntered', label: '进入步骤时' },
        { value: 'NodeCompleted', label: '完成步骤时' },
      ] as const);
}
export function supportsTaskCandidates(event: WorkflowNotificationEvent) {
  return ['TaskCreated', 'TaskDeadline', 'TaskReminder'].includes(event);
}

// 本地校验用于定位错误；权限、联系方式和投递配置由服务端最终校验。
export function notificationErrors(node: WorkflowNode): string[] {
  const errors: string[] = [];
  const events = new Set<string>();
  for (const [index, item] of (node.notifications ?? []).entries()) {
    const prefix = `步骤「${node.name}」第 ${index + 1} 条通知`;
    if (
      !notificationEvents(node.type).some((event) => event.value === item.event)
    )
      errors.push(`${prefix}的触发时机不受支持。`);
    if (events.has(item.event)) errors.push(`${prefix}的触发时机重复。`);
    events.add(item.event);
    if (
      !['applicant', 'initiator', 'taskCandidates'].includes(item.recipient) ||
      (item.recipient === 'taskCandidates' &&
        !supportsTaskCandidates(item.event))
    )
      errors.push(`${prefix}的接收人不受支持。`);
    if (
      !Array.isArray(item.channels) ||
      item.channels.length === 0 ||
      new Set(item.channels).size !== item.channels.length ||
      item.channels.some(
        (channel) =>
          !notificationChannels.some((entry) => entry.value === channel),
      )
    )
      errors.push(`${prefix}请选择有效通知渠道。`);
    for (const [key, max] of [
      ['title', 120],
      ['content', 4000],
    ] as const) {
      const text = item[key];
      if (typeof text !== 'string' || !text.trim() || text.length > max) {
        errors.push(
          `${prefix}${key === 'title' ? '标题' : '正文'}不能为空且不能超过 ${max} 字。`,
        );
        continue;
      }
      if (/<[^>]*>|!\[|(?:javascript|data|vbscript)\s*:/i.test(text))
        errors.push(`${prefix}不能包含 HTML、图片或危险链接。`);
      // 链接目标只能是作者填写的静态 HTTPS 地址，变量不能成为可点击目标。
      for (const match of text.matchAll(/\]\(([^)]*)\)/g)) {
        const target = match[1] ?? '';
        try {
          const url = new URL(target);
          if (
            target.includes('{{') ||
            target.includes('}}') ||
            url.protocol !== 'https:' ||
            url.username ||
            url.password
          )
            errors.push(
              `${prefix}链接目标必须是静态 HTTPS 地址，不能使用模板变量。`,
            );
        } catch {
          errors.push(
            `${prefix}链接目标必须是静态 HTTPS 地址，不能使用模板变量。`,
          );
        }
      }
      const remainder = text.replaceAll(
        /\{\{\s*([\w.]+)\s*\}\}/g,
        (token, variable: string) =>
          notificationVariables.some((entry) => entry.key === variable)
            ? ''
            : token,
      );
      if (remainder.includes('{{') || remainder.includes('}}'))
        errors.push(`${prefix}包含不支持的模板变量。`);
    }
  }
  return errors;
}

// 只替换平台固定变量生成示意内容，不读取实际业务记录或执行表达式。
export function notificationPreview(
  item: WorkflowNotification,
  name: string,
  nodeName: string,
  field: 'content' | 'title' = 'content',
) {
  const sample: Record<string, string> = {
    'process.name': name,
    'node.name': nodeName,
    'event.name':
      notificationEvents('userTask').find((event) => event.value === item.event)
        ?.label ??
      notificationEvents('start').find((event) => event.value === item.event)
        ?.label ??
      '',
    'action.name': '通过',
    'business.id': '示例记录',
  };
  return item[field].replaceAll(
    /\{\{\s*([\w.]+)\s*\}\}/g,
    (token, key: string) => {
      const value = sample[key];
      if (value === undefined) return token;
      if (field === 'title') return value;
      return value.replaceAll(/([\\`*_{}[\]()#+\-.!<>|~])/g, (character) =>
        String.fromCodePoint(92, character.codePointAt(0) ?? 0),
      );
    },
  );
}

// 短信预览剥离常用 Markdown 标记，最终投递以服务端转换为准。
export function notificationPlainText(markdown: string) {
  // 转义字符先保护为不会命中 Markdown 的占位，再恢复为字面值，保持业务名称中的标点。
  const literals: string[] = [];
  let marker = '\uE000';
  while (markdown.includes(marker)) marker += '\uE000';
  const protectedMarkdown = markdown.replaceAll(
    /\\([\\`*_{}[\]()#+\-.!<>|~])/g,
    (_, value: string) => {
      literals.push(value);
      return `${marker}${literals.length - 1}\uE001`;
    },
  );
  const text = protectedMarkdown
    .replaceAll(/<[^>]*>/g, '')
    .replaceAll(/!\[([^\]\r\n]*)\]\([^\r\n)]*\)/g, '$1')
    .replaceAll(/\[([^\]\r\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
    .replaceAll(/\[([^\]\r\n]+)\]\([^\r\n)]*\)/g, '$1')
    .replaceAll(/^ {0,3}#{1,6} +/gm, '')
    .replaceAll(/^ *[-*+] +/gm, '')
    .replaceAll(/^ *\d+[.)] +/gm, '')
    .replaceAll('**', '')
    .replaceAll('__', '')
    .replaceAll('`', '');
  return text.replaceAll(
    new RegExp(`${marker}(\\d+)\uE001`, 'g'),
    (_, index: string) => literals[Number(index)] ?? '',
  );
}
