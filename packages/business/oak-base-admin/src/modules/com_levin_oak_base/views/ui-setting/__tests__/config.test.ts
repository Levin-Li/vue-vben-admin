import { describe, expect, it } from 'vitest';

import { oakBaseAdminCrudResources } from '../../../admin-crud';
import { oakBaseAdminBackendRouteMappings } from '../../../backend-route-mappings';
import { uiSettingPageCrudConfig } from '../config';

describe('uiSettingPageCrudConfig', () => {
  it('keeps valueContent out of the create and ordinary edit forms', () => {
    const valueContentField = uiSettingPageCrudConfig.fields.find(
      (field) => field.key === 'valueContent',
    );

    expect(valueContentField).toMatchObject({
      form: false,
      table: false,
    });
  });

  it('uses the original UiSetting CRUD resource', () => {
    expect(uiSettingPageCrudConfig.apiBase).toBe('/UiSetting');
    expect(uiSettingPageCrudConfig.apiService).toBeDefined();
  });

  it('uses distinct organization-category and organization-type options for the matching scope', () => {
    expect(
      uiSettingPageCrudConfig.fields.find(
        (field) => field.key === 'orgCategory',
      ),
    ).toMatchObject({
      label: '组织类别',
      type: 'select',
    });
    expect(
      uiSettingPageCrudConfig.fields.find((field) => field.key === 'orgType'),
    ).toMatchObject({
      label: '组织类型',
      type: 'select',
    });
  });

  it('exposes all four matching-scope audience fields in search and table configs', () => {
    for (const key of ['orgCategory', 'orgType', 'userCategory', 'userType']) {
      expect(
        uiSettingPageCrudConfig.fields.find((field) => field.key === key),
      ).toMatchObject({
        search: true,
        type: 'select',
      });
    }
  });

  it('keeps new UI settings editable when the hidden editable field is omitted', () => {
    expect(uiSettingPageCrudConfig.transformSubmit?.(
      { code: '全局组织选择器' },
      null,
    )).toMatchObject({
      code: '全局组织选择器',
      editable: true,
    });
  });

  it('registers the UiSetting resource and its frontend route mapping', () => {
    expect(oakBaseAdminCrudResources).toContainEqual(
      expect.objectContaining({
        resource: 'UiSetting',
        title: '界面设置',
      }),
    );
    expect(oakBaseAdminBackendRouteMappings).toContainEqual(
      expect.objectContaining({
        path: '/clob/V1/UiSetting',
        sourceFilePath: 'modules/com_levin_oak_base/views/ui-setting/index.vue',
      }),
    );
  });
});
