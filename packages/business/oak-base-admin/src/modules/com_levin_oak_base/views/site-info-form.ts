import type { CrudFieldConfig } from '@levin/admin-framework/framework-commons/shared/types';

const SITE_INFO_FIELD_NAMES = [
  'shortcutIcon',
  'logo',
  'title',
  'titleImg',
  'bannerImg',
  'mainImg',
  'bigImg',
  'techSupport',
  'copyright',
] as const;

export const siteInfoFormFields: CrudFieldConfig[] = [
  {
    key: 'siteInfo.shortcutIcon',
    label: '快捷图标',
    layoutNewRow: true,
    type: 'image',
  },
  {
    key: 'siteInfo.logo',
    label: 'Logo',
    table: true,
    type: 'image',
    width: 90,
  },
  { key: 'siteInfo.title', label: '标题' },
  { key: 'siteInfo.titleImg', label: '标题图', type: 'image' },
  { key: 'siteInfo.bannerImg', label: '横幅图', type: 'image' },
  { key: 'siteInfo.mainImg', label: '主图', type: 'image' },
  { key: 'siteInfo.bigImg', label: '大图', type: 'image' },
  {
    key: 'siteInfo.techSupport',
    label: '技术支持',
    fullRow: true,
    type: 'textarea',
  },
  {
    key: 'siteInfo.copyright',
    label: '版权声明',
    fullRow: true,
    type: 'textarea',
  },
];

export function transformSiteInfoSubmit(
  values: Record<string, any>,
  record?: Record<string, any>,
) {
  const nextValues = { ...values };
  const siteInfo = { ...(record?.siteInfo || {}) };
  let hasSiteInfoUpdate = false;

  for (const fieldName of SITE_INFO_FIELD_NAMES) {
    const key = `siteInfo.${fieldName}`;
    const value = nextValues[key];
    delete nextValues[key];

    if (value !== undefined) {
      siteInfo[fieldName] = value;
      hasSiteInfoUpdate = true;
    }
  }

  if (hasSiteInfoUpdate) {
    nextValues.siteInfo = siteInfo;
  }

  if (record?.id) {
    nextValues.autoForceUpdateField = true;
  }

  return nextValues;
}
