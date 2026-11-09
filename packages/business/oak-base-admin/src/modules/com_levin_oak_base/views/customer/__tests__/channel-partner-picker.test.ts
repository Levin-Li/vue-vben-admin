import { flushPromises, shallowMount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import ChannelPartnerPicker from '../channel-partner-picker.vue';

const mocked = vi.hoisted(() => ({
  load: vi.fn(),
  scoped: vi.fn(),
  retrieve: vi.fn(),
}));
vi.mock('../channel-partner-reference', () => ({
  loadChannelReferencePage: mocked.scoped,
}));
vi.mock('../channel-partner-options', () => ({
  loadChannelPartnerPage: mocked.load,
}));
vi.mock('../../../api/channel-partner-service', () => ({
  channelPartnerService: { retrieve: mocked.retrieve },
}));
const SelectStub = defineComponent({
  name: 'ASelect',
  props: { disabled: Boolean, options: { type: Array, default: () => [] } },
  template: '<div />',
});

describe('客户渠道租户范围', () => {
  it('普通租户的详情被脱敏时仍回显由服务端授权的名称', async () => {
    mocked.load.mockReset().mockResolvedValue({ options: [], hasMore: false });
    mocked.retrieve
      .mockReset()
      .mockResolvedValue({ id: 'partner-a', name: '授权渠道' });
    const wrapper = shallowMount(ChannelPartnerPicker, {
      props: { tenantId: 'tenant-a', modelValue: 'partner-a' },
      global: { stubs: { ASelect: SelectStub } },
    });
    await flushPromises();
    expect(mocked.retrieve).toHaveBeenCalledWith({
      id: 'partner-a',
      tenantId: 'tenant-a',
    });
    expect(wrapper.findComponent(SelectStub).props('options')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'partner-a',
          label: expect.stringContaining('授权渠道'),
        }),
      ]),
    );
    wrapper.unmount();
  });

  it('平台未选租户时禁用，切换租户清除旧值并请求新租户', async () => {
    mocked.load.mockReset().mockResolvedValue({ options: [], hasMore: false });
    mocked.retrieve.mockReset().mockResolvedValue({ id: 'partner-a' });
    mocked.scoped
      .mockReset()
      .mockResolvedValue({ options: [], hasMore: false });
    const wrapper = shallowMount(ChannelPartnerPicker, {
      props: { requireTenant: true },
      global: { stubs: { ASelect: SelectStub } },
    });
    await flushPromises();
    expect(wrapper.findComponent(SelectStub).props('disabled')).toBe(true);
    expect(mocked.load).not.toHaveBeenCalled();
    await wrapper.setProps({ tenantId: 'tenant-a', modelValue: 'partner-a' });
    await flushPromises();
    expect(mocked.scoped).toHaveBeenCalledWith('tenant-a', 1, '');
    expect(mocked.scoped).toHaveBeenCalledWith('tenant-a', 1, '', 'partner-a');
    expect(mocked.retrieve).not.toHaveBeenCalled();
    await wrapper.setProps({ tenantId: 'tenant-b' });
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')).toContainEqual([undefined]);
    expect(mocked.scoped).toHaveBeenCalledWith('tenant-b', 1, '');
    wrapper.unmount();
  });
});
