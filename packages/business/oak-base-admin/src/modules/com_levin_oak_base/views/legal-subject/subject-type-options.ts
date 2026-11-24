import type { SelectOption } from '@levin/admin-framework';

import { buildEnumOptionsLoader } from '../api-module';

// 法律主体页面和快捷新增共用同一枚举来源。
export const subjectTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.LegalSubjectType',
);

// 快捷开户依赖统一社会信用代码，仅开放服务端支持的类型。
export function toQuickAddSubjectTypeOptions(options: SelectOption[]) {
  const supported = new Set(['Legal', 'Individual', 'NotLegal']);
  return options.map((option) => ({
    ...option,
    disabled: option.disabled || !supported.has(String(option.value)),
    ...(!supported.has(String(option.value))
      ? { title: '此类型暂不支持快捷开户' }
      : {}),
  }));
}
