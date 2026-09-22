interface ActionLogRecord {
  action?: unknown;
  afterStatus?: unknown;
  beforeStatus?: unknown;
  extInfo?: unknown;
  occurTime?: unknown;
  operator?: unknown;
  remark?: unknown;
}

const SIMPLE_FLOW_STATUS_LABELS: Record<string, string> = {
  Approved: '审核通过',
  Archived: '已存档',
  AuditPending: '待审核',
  AuditRejected: '审核拒绝',
  Deleted: '已删除',
  Draft: '草稿',
  Offline: '已下线',
  Published: '已发布',
};

export interface ActionLogTooltipItem {
  key: string;
  occurTime: string;
  operator: string;
  remark?: string;
  transition: string;
}

function parseActionLogValue(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return parseActionLogValue(parsed);
    } catch {
      return [];
    }
  }

  if (value && typeof value === 'object') {
    return [value];
  }

  return [];
}

function formatActionLogFieldValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatWorkflowStatusLabel(value: unknown) {
  const text = formatActionLogFieldValue(value);
  const enumLabel = text.match(/^[\w$.]+[-:：](.+)$/)?.[1]?.trim();

  return enumLabel || SIMPLE_FLOW_STATUS_LABELS[text] || text;
}

function isDisplayableActionLog(record: ActionLogRecord) {
  return [
    record.occurTime,
    record.operator,
    record.beforeStatus,
    record.action,
    record.afterStatus,
    record.remark,
  ].some((value) => formatActionLogFieldValue(value));
}

function buildActionLogTransition(record: ActionLogRecord) {
  // 状态流转统一使用中文标签，避免向用户泄露枚举常量或内部字段名。
  const beforeStatus = formatWorkflowStatusLabel(record.beforeStatus) || '-';
  const action = formatActionLogFieldValue(record.action) || '操作';
  const afterStatus = formatWorkflowStatusLabel(record.afterStatus) || '-';

  return `${beforeStatus} → [${action}] → ${afterStatus}`;
}

export function buildActionLogTooltipItems(
  value: unknown,
): ActionLogTooltipItem[] {
  return parseActionLogValue(value)
    .map((item, index) => ({ index, item }))
    .filter(({ item }) => item && typeof item === 'object')
    .toSorted(({ item: left }, { item: right }) =>
      formatActionLogFieldValue(
        (left as ActionLogRecord).occurTime,
      ).localeCompare(
        formatActionLogFieldValue((right as ActionLogRecord).occurTime),
      ),
    )
    .flatMap(({ item, index }) => {
      const record = item as ActionLogRecord;
      if (!isDisplayableActionLog(record)) {
        return [];
      }

      return [
        {
          key: String(index),
          occurTime: formatActionLogFieldValue(record.occurTime) || '-',
          operator: formatActionLogFieldValue(record.operator) || '-',
          remark: formatActionLogFieldValue(record.remark) || undefined,
          transition: buildActionLogTransition(record),
        },
      ];
    });
}

export function hasDisplayableActionLog(value: unknown) {
  return buildActionLogTooltipItems(value).length > 0;
}
