/* eslint-disable vue/one-component-per-file -- 局部控件替身只负责触发管理页公开的行操作与弹窗按钮。 */
import type { DataModelDefinition } from '../../../api/data-model-service';

import { flushPromises, shallowMount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import ModelPage from '../index.vue';

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  sync: vi.fn(),
  setModelEnabled: vi.fn(),
  deleteModel: vi.fn(),
  getDefinition: vi.fn(),
  saveFields: vi.fn(),
  reload: vi.fn(),
  notifyError: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  routerReplace: vi.fn(),
  invalidateCachedRouteViews: vi.fn(),
  setIsAccessChecked: vi.fn(),
}));

vi.mock('../../../api/data-model-service', () => ({
  dataModelService: {
    preview: mocks.preview,
    sync: mocks.sync,
    setModelEnabled: mocks.setModelEnabled,
    deleteModel: mocks.deleteModel,
    getDefinition: mocks.getDefinition,
    saveFields: mocks.saveFields,
  },
}));
vi.mock('../../api-module', () => ({
  confidentialLevelOptionsLoader: () => Promise.resolve([]),
}));
vi.mock('@levin/admin-framework/framework-commons/app/api', () => ({
  notifyApiErrorOnce: mocks.notifyError,
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, method: string) => method,
  }),
);
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: { id: 'sa', roles: ['R_PLATFORM_SA'] } }),
  useAccessStore: () => ({ setIsAccessChecked: mocks.setIsAccessChecked }),
  useTabbarStore: () => ({
    invalidateCachedRouteViews: mocks.invalidateCachedRouteViews,
  }),
}));
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRouter: () => ({
    currentRoute: { value: { fullPath: '/clob/V1/DomainDataDynamicModel' } },
    replace: mocks.routerReplace,
  }),
}));
vi.mock('../model-metadata', async () => {
  const { ref } = await import('vue');
  return { useModelMetadataContext: () => ref('same-user') };
});
vi.mock('../definition-crud-adapter', () => ({
  definitionCrudConfig: (options: Record<string, unknown>) => options,
}));
vi.mock('ant-design-vue', async (original) => ({
  ...(await original<typeof import('ant-design-vue')>()),
  message: {
    error: mocks.error,
    success: mocks.success,
    warning: mocks.warning,
  },
}));

const record = (): DataModelDefinition =>
  ({
    key: 'invoice',
    version: 4,
    enabled: true,
    syncedVersion: 4,
    fields: [],
  }) as unknown as DataModelDefinition;

const CrudStub = defineComponent({
  props: { config: { type: Object, required: true } },
  setup(props, { expose }) {
    expose({ reload: mocks.reload });
    return () =>
      h(
        'div',
        (
          (
            props.config as {
              rowActions: Array<{
                handler: (row: DataModelDefinition) => unknown;
                label: string;
                visible?: (row: DataModelDefinition) => boolean;
              }>;
            }
          ).rowActions || []
        )
          .filter((action) => !action.visible || action.visible(record()))
          .map((action) =>
            h(
              'button',
              { onClick: () => action.handler(record()) },
              action.label,
            ),
          ),
      );
  },
});

const ModalStub = defineComponent({
  props: {
    open: Boolean,
    title: { type: String, default: '' },
    okButtonProps: { type: Object, default: () => ({}) },
  },
  emits: ['ok'],
  setup(props, { emit }) {
    return () =>
      props.open
        ? h('div', { 'data-modal': props.title }, [
            h(
              'button',
              {
                disabled: Boolean(
                  (props.okButtonProps as { disabled?: boolean }).disabled,
                ),
                onClick: () => emit('ok'),
              },
              '确认弹窗',
            ),
          ])
        : null;
  },
});

function mountPage() {
  return shallowMount(ModelPage, {
    global: { stubs: { DynamicCrudPage: CrudStub, AModal: ModalStub } },
  });
}

async function clickRowAction(
  wrapper: ReturnType<typeof mountPage>,
  label: string,
) {
  const button = wrapper
    .findAll('button')
    .find((item) => item.text() === label);
  if (!button) throw new Error(`找不到行操作：${label}`);
  await button.trigger('click');
  await flushPromises();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reload.mockResolvedValue(undefined);
  mocks.routerReplace.mockResolvedValue(undefined);
  mocks.invalidateCachedRouteViews.mockResolvedValue(undefined);
});

describe('领域数据动态模型管理页行操作', () => {
  it('结构预览有风险时禁用同步，且不会调用同步接口', async () => {
    mocks.preview.mockResolvedValue({
      definitionVersion: 4,
      fingerprint: 'sha-risk',
      risks: ['删除字段会丢失数据'],
      sql: ['ALTER TABLE invoice DROP COLUMN amount'],
    });
    const wrapper = mountPage();
    await clickRowAction(wrapper, '预览结构差异');

    expect(mocks.preview).toHaveBeenCalledWith('invoice');
    const confirm = wrapper.find('[data-modal="数据库结构差异"] button');
    expect(confirm.attributes('disabled')).toBeDefined();
    const modal = wrapper
      .findAllComponents(ModalStub)
      .find((item) => item.props('title') === '数据库结构差异');
    if (!modal) throw new Error('未打开结构预览弹窗');
    modal.vm.$emit('ok');
    await flushPromises();
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it('安全预览后使用本次版本和指纹同步，并刷新列表', async () => {
    mocks.preview.mockResolvedValue({
      definitionVersion: 4,
      fingerprint: 'sha-safe',
      risks: [],
      sql: ['CREATE TABLE invoice'],
    });
    mocks.sync.mockResolvedValue(undefined);
    const wrapper = mountPage();
    await clickRowAction(wrapper, '预览结构差异');
    await wrapper.find('[data-modal="数据库结构差异"] button').trigger('click');
    await flushPromises();

    expect(mocks.sync).toHaveBeenCalledWith('invoice', 4, 'sha-safe');
    expect(mocks.reload).toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith('数据库结构同步完成');
  });

  it('启停行操作仅翻转目标状态并刷新列表', async () => {
    mocks.setModelEnabled.mockResolvedValue(undefined);
    const wrapper = mountPage();
    await clickRowAction(wrapper, '启用/禁用');

    expect(mocks.setModelEnabled).toHaveBeenCalledWith('invoice', false);
    expect(mocks.reload).toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith('模型已禁用');
  });

  it('删除定义失败时保留导航且显示接口错误', async () => {
    const failure = new Error('表内仍有记录');
    mocks.deleteModel.mockRejectedValue(failure);
    const wrapper = mountPage();
    await clickRowAction(wrapper, '删除定义');

    expect(mocks.deleteModel).toHaveBeenCalledWith('invoice', 4);
    expect(mocks.notifyError).toHaveBeenCalledWith(failure);
    expect(mocks.routerReplace).not.toHaveBeenCalled();
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it('字段保存失败时保持编辑弹窗，提示错误且不刷新列表', async () => {
    const failure = new Error('定义版本冲突');
    mocks.getDefinition.mockResolvedValue(record());
    mocks.saveFields.mockRejectedValue(failure);
    const wrapper = mountPage();
    await clickRowAction(wrapper, '字段管理');
    await wrapper.find('[data-modal="模型字段管理"] button').trigger('click');
    await flushPromises();

    expect(mocks.getDefinition).toHaveBeenCalledWith('invoice');
    expect(mocks.saveFields).toHaveBeenCalledWith({
      key: 'invoice',
      expectedVersion: 4,
      fields: [],
      permissionGroups: [],
    });
    expect(mocks.notifyError).toHaveBeenCalledWith(failure);
    expect(wrapper.find('[data-modal="模型字段管理"]').exists()).toBe(true);
    expect(mocks.reload).not.toHaveBeenCalled();
  });
});
