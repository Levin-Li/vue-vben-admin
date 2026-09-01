import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/ui-setting-service', () => ({
  uiSettingService: {},
}));

vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  buildEnumOptionsLoader: () => async () => [],
  tenantOptionsLoader: async () => [],
}));

import {
  GLOBAL_ORG_SELECTOR_SETTING_CODE,
  GLOBAL_ORG_SELECTOR_SETTING_EDITOR,
  GLOBAL_ORG_SELECTOR_SETTING_TYPE,
  globalOrgSelectorSettingPageCrudConfig,
} from '../config';
import { resolveSettingEditorKind } from '../../setting-for-tenant/setting-for-tenant';

describe('global org selector setting config', () => {
  it('fixes the UiSetting code and structured editor without page-local forced-field lists', () => {
    expect(globalOrgSelectorSettingPageCrudConfig.defaultQuery).toMatchObject({
      code: GLOBAL_ORG_SELECTOR_SETTING_CODE,
    });

    const payload =
      globalOrgSelectorSettingPageCrudConfig.transformSubmit?.(
        { name: '租户经销商组织选择器', valueContent: { orgTypes: ['Dealer'] } },
        null,
      );

    expect(payload).toMatchObject({
      code: GLOBAL_ORG_SELECTOR_SETTING_CODE,
      editor: GLOBAL_ORG_SELECTOR_SETTING_EDITOR,
      type: GLOBAL_ORG_SELECTOR_SETTING_TYPE,
      valueContent: { orgTypes: ['Dealer'] },
    });
    expect(payload?.forceUpdateFields).toBeUndefined();
  });

  it('keeps UiSetting context dimensions editable while hiding technical fields', () => {
    const fields = globalOrgSelectorSettingPageCrudConfig.fields;

    ['tenantId', 'domain', 'orgType', 'userType'].forEach((key) => {
      expect(fields.find((field) => field.key === key)?.form).not.toBe(false);
    });

    ['code', 'editor', 'type'].forEach((key) => {
      expect(fields.find((field) => field.key === key)).toBeUndefined();
    });

    expect(fields.find((field) => field.key === 'valueContent')).toMatchObject({
      type: 'json',
    });
  });

  it('uses UiSetting.type as the structured editor value type', () => {
    expect(
      resolveSettingEditorKind({
        editor: GLOBAL_ORG_SELECTOR_SETTING_EDITOR,
        type: GLOBAL_ORG_SELECTOR_SETTING_TYPE,
      }),
    ).toBe('json-schema');
  });
});
