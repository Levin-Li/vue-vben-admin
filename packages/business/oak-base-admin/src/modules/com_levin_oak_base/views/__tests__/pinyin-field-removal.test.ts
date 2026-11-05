import { describe, expect, it } from 'vitest';

import { areaPageCrudConfig } from '../area/config';
import { articleChannelPageCrudConfig } from '../article-channel/config';
import { jobPostPageCrudConfig } from '../job-post/config';
import { memberUserPageCrudConfig } from '../member-user/config';
import { settingPageCrudConfig } from '../setting/config';
import { urlExAclPageCrudConfig } from '../url-ex-acl/config';
import { userPageCrudConfig } from '../user/config';

describe('不再展示或查询已移除的拼音名属性', () => {
  it.each([
    ['行政区划', areaPageCrudConfig],
    ['文章频道', articleChannelPageCrudConfig],
    ['岗位', jobPostPageCrudConfig],
    ['会员用户', memberUserPageCrudConfig],
    ['设置', settingPageCrudConfig],
    ['URL 权限', urlExAclPageCrudConfig],
    ['用户', userPageCrudConfig],
  ] as const)('%s 页面不包含拼音名字段', (_name, config) => {
    const keys = config.fields.map((field) => field.key);
    expect(keys).not.toContain('pinyinName');
    expect(keys).not.toContain('containsPinyinName');
  });
});
