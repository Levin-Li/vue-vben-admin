import { describe, expect, it, vi } from 'vitest';

import { partnerPageCrudConfig } from '../config';

vi.mock('../../../api/partner-service', () => ({
  partnerService: {},
}));

vi.mock('../../api-module', () => ({
  buildEnumOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  FILE_STORAGE_SINGLE_UPLOAD_PATH: '/FileStorage/uploadSingleFile',
  tenantOptionsLoader: async () => [],
  withModuleCrudConfig: (config: any) => config,
}));

describe('partner page config', () => {
  it('uses titled form groups and image uploads for certification materials', () => {
    const fields = partnerPageCrudConfig.fields;

    expect(fields.find((field) => field.key === 'category')).toMatchObject({
      layoutGroupTitle: '归属与分类',
    });
    expect(fields.find((field) => field.key === 'shortName')).toMatchObject({
      layoutGroupTitle: '主体信息',
    });
    expect(fields.find((field) => field.key === 'taxpayerId')).toMatchObject({
      layoutGroupTitle: '主体证照与地址',
    });
    expect(fields.find((field) => field.key === 'legalRepresentativeName')).toMatchObject({
      layoutGroupTitle: '法人、联系人与资质照片',
    });
    for (const key of [
      'businessLicenseFileUrl',
      'legalRepresentativeIdentityFrontImageUrl',
      'legalRepresentativeIdentityBackImageUrl',
      'contactIdentityFrontImageUrl',
      'contactIdentityBackImageUrl',
      'storefrontImageUrl',
    ]) {
      expect(fields.find((field) => field.key === key)).toMatchObject({
        type: 'image',
      });
    }
  });
});
