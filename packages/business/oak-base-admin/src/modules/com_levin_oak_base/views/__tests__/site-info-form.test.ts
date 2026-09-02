import { describe, expect, it } from 'vitest';

import { siteInfoFormFields, transformSiteInfoSubmit } from '../site-info-form';

describe('site info form fields', () => {
  it('covers every SiteInfo display field required by tenant and tenant-site pages', () => {
    expect(siteInfoFormFields.map((field) => field.key)).toEqual([
      'siteInfo.shortcutIcon',
      'siteInfo.logo',
      'siteInfo.title',
      'siteInfo.titleImg',
      'siteInfo.bannerImg',
      'siteInfo.mainImg',
      'siteInfo.bigImg',
      'siteInfo.techSupport',
      'siteInfo.copyright',
    ]);
  });

  it('writes flattened form fields back to the nested SiteInfo payload', () => {
    expect(
      transformSiteInfoSubmit(
        {
          id: 'tenant-1',
          name: '默认租户',
          'siteInfo.bannerImg': '/banner.png',
          'siteInfo.mainImg': '/main.png',
          'siteInfo.title': '租户门户',
        },
        { id: 'tenant-1', siteInfo: { copyright: 'Existing Copyright' } },
      ),
    ).toEqual({
      autoForceUpdateField: true,
      id: 'tenant-1',
      name: '默认租户',
      siteInfo: {
        bannerImg: '/banner.png',
        copyright: 'Existing Copyright',
        mainImg: '/main.png',
        title: '租户门户',
      },
    });
  });

  it('does not send an empty SiteInfo object when no display field is edited', () => {
    expect(transformSiteInfoSubmit({ name: '默认租户' })).toEqual({
      name: '默认租户',
    });
  });


  it('enables generated request force-update mode only for an edit', () => {
    expect(
      transformSiteInfoSubmit(
        { id: 'site-1', name: '更新后的站点' },
        { id: 'site-1' },
      ),
    ).toEqual({
      autoForceUpdateField: true,
      id: 'site-1',
      name: '更新后的站点',
    });
  });
});
