import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import Profile from '../profile.vue';

vi.mock('@vben-core/preferences', () => ({
  preferences: { app: { defaultAvatar: '' } },
}));

vi.mock('@vben-core/shadcn-ui', () => {
  const Container = defineComponent({ template: '<div><slot /></div>' });
  return {
    Card: Container,
    Separator: Container,
    Tabs: Container,
    TabsList: Container,
    TabsTrigger: Container,
    VbenAvatar: Container,
  };
});

vi.mock('../../../components', () => ({
  Page: defineComponent({ template: '<main><slot /></main>' }),
}));

describe('个人中心摘要', () => {
  it('同名长账号只显示一次并保留完整提示', () => {
    const account = 'qa_register_live_20260908_1055';
    const wrapper = mount(Profile, {
      props: {
        modelValue: 'basic',
        tabs: [],
        userInfo: { realName: account, username: account },
      },
    });

    const names = wrapper.findAll('[title]');
    expect(names).toHaveLength(1);
    expect(names[0]?.attributes('title')).toBe(account);
    expect(names[0]?.classes()).toContain('truncate');
  });

  it('名称缺失时使用账号作为主展示，名称不同时显示次级账号', () => {
    const wrapper = mount(Profile, {
      props: {
        modelValue: 'basic',
        tabs: [],
        userInfo: { realName: '测试用户', username: 'long-account-name' },
      },
    });

    expect(wrapper.text()).toContain('测试用户');
    expect(wrapper.text()).toContain('long-account-name');
    expect(wrapper.findAll('[title]')).toHaveLength(2);
  });
});
