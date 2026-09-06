import type { CrudFieldConfig } from './types';

import { applyAreaCascaderValueToRecord } from './area-cascader';

/** 只有显式展示开关且取消勾选，才排除普通分组。 */
export function getUnsubmittedCrudGroupFields(
  fields: CrudFieldConfig[],
  checked: Record<string, boolean>,
) {
  return fields.filter(
    (field) =>
      !field.complexGroupKey &&
      field.displayGroup?.showSubmitCheckbox === true &&
      checked[field.displayGroup.key] === false,
  );
}

export function omitUnsubmittedCrudGroupFields(
  payload: Record<string, any>,
  fields: CrudFieldConfig[],
  protectedKeys: string[] = [],
) {
  if (fields.length === 0) return payload;
  const excluded = new Set<string>();
  for (const field of fields) {
    excluded.add(field.key);
    if (field.type === 'area-cascader') {
      for (const key of Object.keys(
        applyAreaCascaderValueToRecord({}, field, [], [], true),
      ))
        excluded.add(key);
    }
  }
  for (const key of protectedKeys) excluded.delete(key);
  const result = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !excluded.has(key)),
  );
  if (Array.isArray(result.forceUpdateFields))
    result.forceUpdateFields = result.forceUpdateFields.filter(
      (key: string) => !excluded.has(key),
    );
  return result;
}

/** 取消只改变本次提交范围，不立即清除用户输入。 */
export function buildGroupSubmitConfirmation(
  title: string,
  onConfirm: () => void,
) {
  return {
    title: '确认不提交分组数据？',
    content: `“${title}”分组当前填写的内容不会保存，关闭表单后将丢失。是否确认不提交？`,
    okText: '确认不提交',
    cancelText: '取消',
    onOk: onConfirm,
  };
}
