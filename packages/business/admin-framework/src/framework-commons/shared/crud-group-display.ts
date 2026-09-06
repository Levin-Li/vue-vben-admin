import type { CrudPageDisplayGroupConfig } from './types';

/** 未配置或无效样式统一使用分隔线，不回写持久化配置。 */
export function normalizeCrudGroupDisplayStyle(style?: string) {
  return style === 'border' || style === 'card' ? style : 'divider';
}

/** 新增、编辑和详情共用分组标题样式。 */
export function getCrudGroupTitleClass(
  style?: CrudPageDisplayGroupConfig['displayStyle'],
) {
  switch (style) {
    case 'border': {
      return 'rounded-lg border border-primary px-4 py-3';
    }
    case 'card': {
      return 'bg-muted/45 rounded-lg border border-border px-4 py-3';
    }
    default: {
      return 'vben-crud-group-divider';
    }
  }
}
