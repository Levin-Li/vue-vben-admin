interface ActionLogRecord {
  action?: unknown;
  afterStatus?: unknown;
  beforeStatus?: unknown;
  extInfo?: unknown;
  occurTime?: unknown;
  operator?: unknown;
  remark?: unknown;
}

export interface ActionLogTooltipItem {
  key: string;
  rows: Array<{
    label: string;
    value: string;
  }>;
}

const ACTION_LOG_FIELDS: Array<{
  key: keyof ActionLogRecord;
  label: string;
}> = [
  { key: 'occurTime', label: '发生时间' },
  { key: 'operator', label: '操作人' },
  { key: 'beforeStatus', label: '动作前状态' },
  { key: 'action', label: '动作' },
  { key: 'afterStatus', label: '动作后状态' },
  { key: 'remark', label: '备注' },
  { key: 'extInfo', label: '扩展信息' },
];

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

export function buildActionLogTooltipItems(
  value: unknown,
): ActionLogTooltipItem[] {
  return parseActionLogValue(value).flatMap((item, index) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const record = item as ActionLogRecord;
    const rows = ACTION_LOG_FIELDS.map(({ key, label }) => ({
      label,
      value: formatActionLogFieldValue(record[key]),
    })).filter((row) => row.value);

    if (rows.length === 0) {
      return [];
    }

    return [
      {
        key: String(index),
        rows,
      },
    ];
  });
}

export function hasDisplayableActionLog(value: unknown) {
  return buildActionLogTooltipItems(value).length > 0;
}
