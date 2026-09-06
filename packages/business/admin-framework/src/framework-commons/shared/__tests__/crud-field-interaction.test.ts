import type { CrudFieldConfig } from '../types';

import { describe, expect, it } from 'vitest';

import { updateCrudFieldInput } from '../crud-field-interaction';
import { serializeCrudFieldValue } from '../crud-field-value';
import { getUnsubmittedCrudGroupFields } from '../crud-group-submit';
import { resolveDisplaySubmitKeys } from '../crud-page-display';
import { resolveCrudQuickFill } from '../crud-quick-fill';
import { omitExcludedCrudFields } from '../crud-submit-fields';

describe('禁提交互和请求资格独立', () => {
  it('禁提保留默认值并参与序列化，按钮事件和异步编辑返回都不能修改', () => {
    const state = { priority: '7' };
    const field: CrudFieldConfig = {
      key: 'priority',
      label: '优先级',
      type: 'number',
    };
    expect(updateCrudFieldInput(state, field.key, 9, true)).toBe(false);
    const keys = resolveDisplaySubmitKeys([{ key: field.key, disabled: true }]);
    expect(
      omitExcludedCrudFields(
        { priority: serializeCrudFieldValue(field, state.priority) },
        keys.has(field.key) ? [] : [field],
      ),
    ).toEqual({ priority: 7 });
    expect(updateCrudFieldInput(state, field.key, '9', false)).toBe(true);
    expect(state.priority).toBe('9');
  });
  it('取消分组提交仍排除禁提值和强制更新字段', () => {
    const field: CrudFieldConfig = {
      key: 'priority',
      label: '优先级',
      displayGroup: { key: 'extra', showSubmitCheckbox: true },
    };
    const excluded = getUnsubmittedCrudGroupFields([field], { extra: false });
    expect(
      omitExcludedCrudFields(
        { priority: 7, forceUpdateFields: ['priority'] },
        excluded,
      ),
    ).toEqual({ forceUpdateFields: [] });
  });
  it('禁提可见字段不增加快捷填写可填写数量', () => {
    const fields = Array.from({ length: 8 }, (_, index) => ({
      key: `f${index}`,
      label: `字段${index}`,
      required: index === 0,
    }));
    expect(
      resolveCrudQuickFill(
        fields,
        new Set(fields.slice(0, 7).map((field) => field.key)),
        new Set(),
      ).eligible,
    ).toBe(false);
  });
});
