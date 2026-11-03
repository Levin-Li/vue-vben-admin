import { flushPromises, mount } from '@vue/test-utils';

import { Select } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import InvitationChannelPicker from '../invitation-channel-picker.vue';

const { targetChannels } = vi.hoisted(() => ({ targetChannels: vi.fn() }));
vi.mock('../../../api/invitation-link-service', () => ({
  invitationLinkService: { targetChannels },
}));

describe('邀请渠道伙伴选择', () => {
  it('切换租户和目标组织后忽略旧响应，并按当前范围搜索', async () => {
    let resolveOld!: (value: Array<{ id: string; name: string }>) => void;
    const old = new Promise<Array<{ id: string; name: string }>>((resolve) => {
      resolveOld = resolve;
    });
    targetChannels.mockImplementation(async (org: string) =>
      org === 'org-a' ? old : [{ id: 'channel-b', name: '乙渠道' }],
    );
    const wrapper = mount(InvitationChannelPicker, {
      props: { tenantId: 'tenant-a', targetOrgId: 'org-a' },
    });
    await wrapper.setProps({ tenantId: 'tenant-b', targetOrgId: 'org-b' });
    await flushPromises();
    resolveOld([{ id: 'channel-a', name: '甲渠道' }]);
    await flushPromises();
    const select = wrapper.findComponent(Select);
    expect(select.props('options')).toEqual([
      { label: '乙渠道', value: 'channel-b' },
    ]);
    select.vm.$emit('search', '乙');
    await flushPromises();
    expect(targetChannels).toHaveBeenLastCalledWith('org-b', 'tenant-b', '乙');
    await wrapper.setProps({ disabled: true, targetOrgId: undefined });
    expect(wrapper.findComponent(Select).props('options')).toEqual([]);
    wrapper.unmount();
  });
});
