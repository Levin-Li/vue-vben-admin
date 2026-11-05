import { describe, expect, it } from 'vitest';

import { clientAppPageCrudConfig } from '../../client-app/config';
import { demoPageCrudConfig } from '../../demo/config';
import { electronicContractTemplatePageCrudConfig } from '../../electronic-contract-template/config';
import { fileResPageCrudConfig } from '../../file-res/config';
import {
  buildMasterPartyFields,
  customerPartnerParties,
} from '../../master-party-fields';
import { memberUserPageCrudConfig } from '../../member-user/config';
import { noticeProcessLogPageCrudConfig } from '../../notice-process-log/config';
import { socialUserPageCrudConfig } from '../../social-user/config';
import { userSettingPageCrudConfig } from '../../user-setting/config';
import { userPageCrudConfig } from '../../user/config';
import { orgPageCrudConfig } from '../config';

describe('管理页面用户选择字段', () => {
  it.each([
    [userSettingPageCrudConfig, 'ownerId'],
    [fileResPageCrudConfig, 'ownerId'],
    [noticeProcessLogPageCrudConfig, 'ownerId'],
    [electronicContractTemplatePageCrudConfig, 'ownerId'],
    [demoPageCrudConfig, 'ownerId'],
    [userPageCrudConfig, 'referrerId'],
    [memberUserPageCrudConfig, 'referrerId'],
    [orgPageCrudConfig, 'responsibleUserId'],
    [clientAppPageCrudConfig, 'serviceUserId'],
    [socialUserPageCrudConfig, 'innerUserId'],
  ])('使用用户选择器', (config, key) => {
    expect(config.fields.find((field) => field.key === key)).toMatchObject({
      type: 'user-tree-select',
    });
  });

  it('保留客户和伙伴五组组织与负责人字段', () => {
    const fields = buildMasterPartyFields(customerPartnerParties, true);
    for (const [party] of customerPartnerParties) {
      expect(
        fields.find((field) => field.key === `${party}OrgId`),
      ).toMatchObject({
        type: 'org-tree-select',
      });
      expect(
        fields.find((field) => field.key === `${party}UserId`),
      ).toMatchObject({
        type: 'user-tree-select',
      });
    }
  });
});
