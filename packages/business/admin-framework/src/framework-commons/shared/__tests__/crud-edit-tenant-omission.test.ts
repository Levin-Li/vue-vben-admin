import { describe, expect, it } from 'vitest';

import { buildCrudJsonFieldUpdatePayload } from '../crud-json-schema-actions';
import {
  getDefaultFieldHidden,
  getDisplaySubmitMode,
  initializeFieldHidden,
  resolveDisplaySubmitKeys,
  resolveRuntimeDisplayField,
} from '../crud-page-display';
import { omitExcludedCrudFields } from '../crud-submit-fields';

describe('编辑租户字段默认展示', () => {
  it('无设置和稀疏设置均默认展示并提交', () => {
    const saved = { key: 'tenantId' };
    const runtime = resolveRuntimeDisplayField(saved, { view: 'edit' });
    expect(getDefaultFieldHidden(saved, { view: 'edit' })).toBe(false);
    expect(initializeFieldHidden(saved, { view: 'edit' })).toBe(false);
    expect(getDisplaySubmitMode(runtime)).toBe('display-submit');
    expect([...resolveDisplaySubmitKeys([runtime])]).toEqual(['tenantId']);
    expect(saved).toEqual({ key: 'tenantId' });
  });

  it.each(['create', 'query', 'detail', 'list'] as const)(
    '%s 视图保留原租户默认',
    (view) => {
      expect(getDefaultFieldHidden('tenantId', { view })).toBe(false);
    },
  );

  it('保留用户明确隐藏设置，不自动改写持久化配置', () => {
    const saved = { hidden: true, key: 'tenantId' };
    expect(
      getDisplaySubmitMode(resolveRuntimeDisplayField(saved, { view: 'edit' })),
    ).toBe('hidden-omit');
    expect(saved).toEqual({ hidden: true, key: 'tenantId' });
  });

  it.each([true, false])(
    '平台身份 %s 显式排除时残留值及强制更新均被清除，JSON 单字段保存不补回',
    (isPlatformUser) => {
      const fields = [
        { key: 'tenantId', label: '租户ID', hidden: true },
        { key: 'configData', label: '配置内容' },
      ];
      const allowed = resolveDisplaySubmitKeys(
        fields.map((field) =>
          resolveRuntimeDisplayField(field, { view: 'edit' }),
        ),
      );
      const record = { id: 'one', optimisticLock: 3, tenantId: 'old-tenant' };
      const transformed = {
        ...record,
        configData: { enabled: true },
        forceUpdateFields: ['tenantId', 'configData'],
      };
      const payload = omitExcludedCrudFields(
        transformed,
        fields.filter((field) => !allowed.has(field.key)),
      );
      expect(payload).toEqual({
        id: 'one',
        optimisticLock: 3,
        configData: { enabled: true },
        forceUpdateFields: ['configData'],
      });
      expect(
        buildCrudJsonFieldUpdatePayload(
          'configData',
          payload,
          record,
          'id',
          isPlatformUser,
        ),
      ).toEqual(payload);
    },
  );
});
