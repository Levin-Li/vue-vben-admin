import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  currentGlobalDomainIds,
  globalDomainContextMultiple,
  setCurrentGlobalDomainIds,
} from '@levin/admin-framework/framework-commons/app/global-domain-context-state';

import GlobalPlatformDomainSelector from '../global-platform-domain-selector.vue';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  loadOptions: vi.fn(),
}));

vi.mock('../api/_module', () => ({ oakBaseGet: mocks.get }));
vi.mock('../domain-scope-options', () => ({
  loadDomainScopeOptions: mocks.loadOptions,
}));
vi.mock(
  '@levin/admin-framework/framework-commons/app/global-domain-context-state',
  async () => {
  const { computed, ref } = await import('vue');
  const domainIds = ref<string[]>([]);
  const multiple = ref(false);

    return {
      currentGlobalDomainIds: computed(() => domainIds.value),
      globalDomainContextMultiple: computed(() => multiple.value),
      setCurrentGlobalDomainIds(value: unknown, isMultiple = false) {
        const values = (Array.isArray(value) ? value : [value])
          .map((item) => String(item ?? '').trim())
          .filter(Boolean);
        domainIds.value = isMultiple ? values : values.slice(0, 1);
        multiple.value = isMultiple;
        return true;
      },
    };
  },
);
vi.mock('ant-design-vue', async () => {
  const { defineComponent } = await import('vue');
  return {
    Select: defineComponent({
      name: 'Select',
      props: {
        allowClear: Boolean,
        loading: Boolean,
        mode: String,
        options: Array,
        value: String,
      },
      emits: ['update:value'],
      template:
        '<button :data-allow-clear="String(allowClear)" :data-mode="mode || \'single\'" :data-value="value" type="button" @click="$emit(\'update:value\', undefined)" />',
    }),
  };
});

describe('GlobalPlatformDomainSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentGlobalDomainIds([]);
    mocks.get.mockResolvedValue({
      valueContent: { multiple: true, type: 'payment.' },
    });
    mocks.loadOptions.mockResolvedValue([
      { label: '支付领域', value: 'domain-1' },
      { label: '结算领域', value: 'domain-2' },
    ]);
  });

  it('忽略远程多选配置，只保留单个领域并允许清空', async () => {
    setCurrentGlobalDomainIds(['domain-1', 'domain-2'], true);
    const wrapper = mount(GlobalPlatformDomainSelector);
    await flushPromises();

    const select = wrapper.get('button');
    expect(select.attributes('data-mode')).toBe('single');
    expect(select.attributes('data-allow-clear')).toBe('true');
    expect(select.attributes('data-value')).toBe('domain-1');
    expect(currentGlobalDomainIds.value).toEqual(['domain-1']);
    expect(globalDomainContextMultiple.value).toBe(false);

    await select.trigger('click');
    expect(currentGlobalDomainIds.value).toEqual([]);
    wrapper.unmount();
  });
});
