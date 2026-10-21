import type { CrudFieldConfig } from './types';
import type { UserOrgSelectorLoadOrgTree } from './user-org-selector-types';

/** 页面显式候选优先；缺省交由通用选择器读取当前授权组织。 */
export function getCrudOrgLoadApi(
  field: CrudFieldConfig,
): undefined | UserOrgSelectorLoadOrgTree {
  const loader = field.loadOptions;
  if (loader) return () => loader('');
  const options = field.options;
  if (options) return async () => options;
  return undefined;
}
