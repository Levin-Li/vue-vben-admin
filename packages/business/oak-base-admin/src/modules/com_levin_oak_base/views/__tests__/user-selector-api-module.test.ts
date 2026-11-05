import { describe, expect, it } from 'vitest';

import { channelPartnerPageCrudConfig } from '../channel-partner/config';
import { clientAppPageCrudConfig } from '../client-app/config';
import { customerPageCrudConfig } from '../customer/config';
import { demoPageCrudConfig } from '../demo/config';
import { electronicContractTemplatePageCrudConfig } from '../electronic-contract-template/config';
import { fileResPageCrudConfig } from '../file-res/config';
import { memberUserPageCrudConfig } from '../member-user/config';
import { noticeProcessLogPageCrudConfig } from '../notice-process-log/config';
import { orgPageCrudConfig } from '../org/config';
import { settlementOrderPageCrudConfig } from '../settlement-order/config';
import { socialUserPageCrudConfig } from '../social-user/config';
import { supplierPartnerPageCrudConfig } from '../supplier-partner/config';
import { userSettingPageCrudConfig } from '../user-setting/config';
import { userPageCrudConfig } from '../user/config';

describe('用户选择器使用正确的模块路径', () => {
  it.each([
    clientAppPageCrudConfig,
    customerPageCrudConfig,
    demoPageCrudConfig,
    electronicContractTemplatePageCrudConfig,
    fileResPageCrudConfig,
    memberUserPageCrudConfig,
    noticeProcessLogPageCrudConfig,
    orgPageCrudConfig,
    channelPartnerPageCrudConfig,
    supplierPartnerPageCrudConfig,
    settlementOrderPageCrudConfig,
    socialUserPageCrudConfig,
    userPageCrudConfig,
    userSettingPageCrudConfig,
  ])('$title 指向基础模块', (config) => {
    expect(config.apiModuleBase).toBe('/com.levin.oak.base/V1/api');
    expect(
      config.fields.some((field) => field.type === 'user-tree-select'),
    ).toBe(true);
  });
});
