import { defineComponent, h } from 'vue';

import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SyncI18nLabelsModal from '../sync-i18n-labels-modal.vue';

const uploadModuleLabels = vi.fn();

vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');

  const Input = defineComponent({
    name: 'InputStub',
    props: {
      allowClear: Boolean,
      placeholder: String,
      value: String,
    },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          'data-allow-clear': props.allowClear ? 'true' : 'false',
          placeholder: props.placeholder,
          value: props.value,
          onInput: (event: Event) =>
            emit('update:value', (event.target as HTMLInputElement).value),
        });
    },
  });

  const Select = defineComponent({
    name: 'SelectStub',
    props: {
      allowClear: Boolean,
      options: Array,
      placeholder: String,
      value: String,
    },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h('select', {
          'data-allow-clear': props.allowClear ? 'true' : 'false',
          value: props.value,
          onChange: (event: Event) =>
            emit('update:value', (event.target as HTMLSelectElement).value),
        });
    },
  });

  return {
    Checkbox: defineComponent({
      name: 'CheckboxStub',
      setup(_, { slots }) {
        return () => h('label', slots.default?.());
      },
    }),
    Input,
    message: {
      success: vi.fn(),
      warning: vi.fn(),
    },
    Modal: defineComponent({
      name: 'ModalStub',
      emits: ['ok', 'update:open'],
      setup(_, { emit, slots }) {
        return () =>
          h('section', { 'data-test': 'modal' }, [
            slots.default?.(),
            h(
              'button',
              {
                'data-test': 'ok',
                onClick: () => emit('ok'),
              },
              'ok',
            ),
          ]);
      },
    }),
    Select,
    Tag: defineComponent({
      name: 'TagStub',
      setup(_, { slots }) {
        return () => h('span', slots.default?.());
      },
    }),
  };
});

vi.mock('@levin/admin-framework/framework-commons/app/adapter/vxe-table', () => ({
  useVbenVxeGrid: () => [
    defineComponent({
      name: 'GridStub',
      setup(_, { slots }) {
        return () =>
          h('div', { 'data-test': 'i18n-grid' }, [
            slots.default?.(),
            slots.selectHeader?.({}),
          ]);
      },
    }),
    {
      setGridOptions: vi.fn(),
    },
  ],
}));

vi.mock('../../../runtime', () => ({
  getAdminI18nLabelSyncService: () => ({
    uploadModuleLabels,
  }),
}));

vi.mock('../../locales', () => ({
  adminFrameworkLocales: {},
}));

vi.mock('../../utils/application-i18n-modules', () => ({
  getApplicationI18nModules: () => [
    {
      locales: {
        'zh-CN': {
          common: {
            save: '保存',
          },
        },
      },
      name: 'com.levin.oak.base',
      title: '基础模块',
    },
  ],
}));

describe('sync i18n labels modal', () => {
  beforeEach(() => {
    uploadModuleLabels.mockReset();
  });

  it('lets operators clear the upload app version and uploads shared tenant labels by default', async () => {
    const wrapper = mount(SyncI18nLabelsModal, {
      props: {
        open: true,
      },
    });

    expect(wrapper.text()).toContain('应用版本号');
    const versionInput = wrapper
      .findAll('input')
      .find((item) => item.attributes('placeholder') === '全部版本');

    expect(versionInput?.exists()).toBe(true);
    expect(versionInput?.attributes('data-allow-clear')).toBe('true');

    await versionInput?.setValue('');
    await wrapper.get('[data-test="ok"]').trigger('click');

    expect(uploadModuleLabels).toHaveBeenCalledTimes(1);
    expect(uploadModuleLabels.mock.calls[0]?.[0]).toMatchObject({
      appVersion: '',
      tenantShared: true,
    });

    wrapper.unmount();
  });
});
