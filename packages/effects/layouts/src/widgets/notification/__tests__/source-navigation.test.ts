import { mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import Notification from '../notification.vue';

const push = vi.hoisted(() => vi.fn());
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@vben/runtime/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/runtime/icons', () => ({
  Bell: { template: '<span />' },
  CircleCheckBig: { template: '<span />' },
  CircleX: { template: '<span />' },
  MailCheck: { template: '<span />' },
}));
vi.mock('@vben-core/ui/shadcn', () => ({
  VbenButton: {
    emits: ['click'],
    template: `<button @click="$emit('click', $event)"><slot /></button>`,
  },
  VbenIconButton: {
    props: ['tooltip'],
    emits: ['click'],
    template: `<button :data-tooltip="tooltip" @click="$emit('click', $event)"><slot /></button>`,
  },
  VbenPopover: { template: '<div><slot /><slot name="trigger" /></div>' },
  VbenScrollbar: { template: '<div><slot /></div>' },
}));
describe('铃铛来源只导航', () => {
  it('点击来源不隐式已读，显式已读按钮仍独立生效', async () => {
    const item = {
      id: 'message-1',
      avatar: '',
      date: '',
      title: '公告提醒',
      message: '摘要',
      isRead: false,
      link: '/clob/V1/MyMessages',
      query: { noticeId: 'notice-1' },
    };
    const wrapper = mount(Notification, {
      props: { count: 1, notifications: [item] },
    });
    await wrapper.find('li').trigger('click');
    expect(push).toHaveBeenCalledWith({
      path: '/clob/V1/MyMessages',
      query: { noticeId: 'notice-1' },
      state: undefined,
    });
    expect(wrapper.emitted('read')).toBeUndefined();
    await wrapper.get('[data-tooltip="common.confirm"]').trigger('click');
    expect(wrapper.emitted('read')).toEqual([[item]]);
  });
});
