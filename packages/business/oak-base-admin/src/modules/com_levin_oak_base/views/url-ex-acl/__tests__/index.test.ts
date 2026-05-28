import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const patternFieldKeys = [
  'urlPathList',
  'urlPathExcludeList',
  'methodList',
  'domainList',
  'regionList',
  'ipList',
  'ipExcludeList',
  'osList',
  'userTypeList',
  'userRoleList',
  'requestParamRuleList',
  'headerRuleList',
];

describe('url ex acl page', () => {
  it('wires common pattern editors for every ACL match list field', () => {
    const source = readFileSync(
      'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/url-ex-acl/index.vue',
      'utf8',
    );

    expect(source).toContain('PatternListFormField');
    expect(source).toContain('MatchTestField');

    for (const key of patternFieldKeys) {
      expect(source).toContain(`#form-field-${key}`);
      expect(source).toContain(`v-model="formState[field.key]"`);
    }

    expect(source).toContain('rule-kind="nameValue"');
  });
});
