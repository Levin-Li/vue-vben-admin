/* eslint-disable vue/one-component-per-file -- 局部控件替身用于验证页面真实按钮事件。 */
import type {
  DataModelDefinition,
  DataModelOperationDefinition,
} from '../../../api/data-model-service';

import { flushPromises, shallowMount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import OperationsManager from '../operations-manager.vue';

const mocks = vi.hoisted(() => ({
  saveOperations: vi.fn(),
  notifyError: vi.fn(),
  recordFailure: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../../api/data-model-service', () => ({
  dataModelService: { saveOperations: mocks.saveOperations },
}));
vi.mock('@levin/admin-framework/framework-commons/app/api', () => ({
  notifyApiErrorOnce: mocks.notifyError,
}));
vi.mock('../../data-model-record/record-errors', () => ({
  recordFailure: mocks.recordFailure,
}));
vi.mock('ant-design-vue', async (original) => ({
  ...(await original<typeof import('ant-design-vue')>()),
  message: { error: mocks.error, success: mocks.success },
}));

const ButtonStub = defineComponent({
  emits: ['click'],
  setup(_, { emit, slots }) {
    return () =>
      h('button', { onClick: () => emit('click') }, slots.default?.());
  },
});

const ModalStub = defineComponent({
  props: { open: Boolean },
  emits: ['ok'],
  setup(props, { emit, slots }) {
    return () =>
      props.open
        ? h('div', [
            slots.default?.(),
            h('button', { onClick: () => emit('ok') }, '确认接口配置'),
          ])
        : null;
  },
});

const TableStub = defineComponent({
  props: {
    dataSource: { type: Array, default: () => [] },
    rowKey: { type: [String, Function], default: undefined },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        props.dataSource.map((record, index) =>
          h(
            'div',
            slots.bodyCell?.({ column: { key: 'actions' }, record, index }),
          ),
        ),
      );
  },
});

const SlotStub = defineComponent({
  setup(_, { slots }) {
    return () => h('div', slots.default?.());
  },
});

const TextAreaStub = defineComponent({
  props: { value: { type: String, default: '' } },
  emits: ['update:value'],
  setup(props, { emit }) {
    return () =>
      h('textarea', {
        value: props.value,
        onInput: (event: Event) =>
          emit('update:value', (event.target as HTMLTextAreaElement).value),
      });
  },
});

const InputStub = defineComponent({
  inheritAttrs: false,
  props: { value: { type: String, default: '' } },
  emits: ['update:value'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        value: props.value,
        onInput: (event: Event) =>
          emit('update:value', (event.target as HTMLInputElement).value),
      });
  },
});

const model = (): DataModelDefinition =>
  ({
    key: 'invoice',
    version: 7,
    fields: [],
    operationDefinitions: [
      {
        code: 'QUERY',
        title: '查询',
        classification: 'STANDARD',
        actionType: 'QUERY',
        target: 'OBJECT',
        enabled: true,
        requestFields: ['status'],
        responseFields: ['amount'],
        requestDefinition: { fields: ['status'] },
        responseDefinition: { fields: ['amount'] },
        requestFieldOptions: [{ name: 'status', title: '状态' }],
        responseFieldOptions: [{ name: 'amount', title: '金额' }],
        queryInputOptions: [{ key: 'status', field: 'status' }],
      },
    ],
  }) as unknown as DataModelDefinition;

function mountManager(editable = true, source = model()) {
  return shallowMount(OperationsManager, {
    props: { editable, model: source },
    global: {
      stubs: {
        AButton: ButtonStub,
        AForm: SlotStub,
        AFormItem: SlotStub,
        AInput: InputStub,
        AInputNumber: SlotStub,
        AModal: ModalStub,
        APopconfirm: SlotStub,
        ASelect: SlotStub,
        ASwitch: SlotStub,
        ATable: TableStub,
        ATextarea: TextAreaStub,
      },
    },
  });
}

async function clickButton(
  wrapper: ReturnType<typeof mountManager>,
  label: string,
) {
  const button = wrapper
    .findAll('button')
    .find((item) => item.text() === label);
  if (!button) throw new Error(`找不到按钮：${label}`);
  await button.trigger('click');
}

function submittedOperations(): DataModelOperationDefinition[] {
  const call = mocks.saveOperations.mock.calls[0];
  if (!call || !Array.isArray(call[2])) throw new Error('测试未提交接口定义');
  return call[2] as DataModelOperationDefinition[];
}

function submittedOperation(): DataModelOperationDefinition {
  const operation = submittedOperations()[0];
  if (!operation) throw new Error('提交的接口列表为空');
  return operation;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('领域模型接口管理交互', () => {
  it('保存时提交模型版本与完整 JSON 契约，剔除仅供界面使用的候选', async () => {
    const saved = { ...model(), version: 8 };
    mocks.saveOperations.mockResolvedValue(saved);
    const wrapper = mountManager();

    await clickButton(wrapper, '保存接口定义');
    await flushPromises();

    expect(mocks.saveOperations).toHaveBeenCalledWith('invoice', 7, [
      expect.objectContaining({
        code: 'QUERY',
        requestDefinition: { fields: ['status'] },
        responseDefinition: { fields: ['amount'] },
      }),
    ]);
    const submitted = submittedOperation();
    expect(submitted).not.toHaveProperty('requestFieldOptions');
    expect(submitted).not.toHaveProperty('responseFieldOptions');
    expect(submitted).not.toHaveProperty('queryInputOptions');
    expect(wrapper.emitted('saved')?.[0]).toEqual([saved]);
    expect(mocks.success).toHaveBeenCalledWith(
      '接口定义已保存，同步模型后生效',
    );
  });

  it('保存失败时报告错误并保留未保存状态，不发出 saved 事件', async () => {
    const failure = new Error('版本已变更');
    mocks.saveOperations.mockRejectedValue(failure);
    const wrapper = mountManager();

    await clickButton(wrapper, '保存接口定义');
    await flushPromises();

    expect(mocks.recordFailure).toHaveBeenCalledWith(
      failure,
      '接口定义保存失败，请刷新模型后重试',
    );
    expect(mocks.notifyError).toHaveBeenCalledWith(failure);
    expect(wrapper.emitted('saved')).toBeUndefined();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('只读模式不提供新增或保存入口', () => {
    const wrapper = mountManager(false);
    expect(wrapper.text()).not.toContain('新增自定义动作');
    expect(wrapper.text()).not.toContain('保存接口定义');
    expect(mocks.saveOperations).not.toHaveBeenCalled();
  });

  it('定义版本变化后提交最新接口列表，缺失版本时拒绝保存', async () => {
    mocks.saveOperations.mockResolvedValue(model());
    const wrapper = mountManager();
    await wrapper.setProps({
      model: {
        ...model(),
        version: 8,
        operationDefinitions: [
          {
            code: 'DETAIL',
            title: '详情',
            enabled: true,
            executionType: 'STANDARD',
            target: 'RECORD',
            requestFields: [],
            responseFields: ['status'],
          },
        ],
      } as DataModelDefinition,
    });
    await clickButton(wrapper, '保存接口定义');
    await flushPromises();
    expect(mocks.saveOperations).toHaveBeenCalledWith('invoice', 8, [
      expect.objectContaining({ code: 'DETAIL' }),
    ]);

    mocks.saveOperations.mockClear();
    await wrapper.setProps({
      model: { ...model(), version: undefined } as DataModelDefinition,
    });
    await clickButton(wrapper, '保存接口定义');
    expect(mocks.saveOperations).not.toHaveBeenCalled();
  });

  it('新增自定义动作未填写名称时拒绝放入待保存接口', async () => {
    const wrapper = mountManager();
    await clickButton(wrapper, '新增自定义动作');
    await clickButton(wrapper, '确认接口配置');

    expect(mocks.error).toHaveBeenCalledWith('请填写接口名称');
    await clickButton(wrapper, '保存接口定义');
    await flushPromises();
    expect(submittedOperations()).toHaveLength(1);
  });

  it('编辑请求 JSON 非法时拒绝更新接口定义', async () => {
    mocks.saveOperations.mockResolvedValue(model());
    const wrapper = mountManager();
    await clickButton(wrapper, '配置');
    const requestEditor = wrapper.findAll('textarea')[0];
    if (!requestEditor) throw new Error('未打开请求定义编辑器');
    await requestEditor.setValue('{invalid');
    await clickButton(wrapper, '确认接口配置');

    expect(mocks.error).toHaveBeenCalledWith(
      '请求定义必须是包含字符串 fields 数组的 JSON 对象',
    );
    await clickButton(wrapper, '保存接口定义');
    await flushPromises();
    expect(submittedOperation().requestDefinition).toEqual({
      fields: ['status'],
    });
  });

  it('查询条件树引用未知参数时拒绝应用接口配置', async () => {
    const source = model();
    const query = source.operationDefinitions?.[0];
    if (!query) throw new Error('测试模型缺少 QUERY 接口');
    source.operationDefinitions = [
      {
        ...query,
        queryInputs: [
          {
            key: 'minimumAmount',
            field: 'amount',
            operator: 'GTE',
            title: '最低金额',
            type: 'MONEY',
            defaultVisible: true,
          },
        ],
        conditionTree: { type: 'PARAM', key: 'unknown' },
      },
    ];
    const wrapper = mountManager(true, source);
    await clickButton(wrapper, '配置');
    await clickButton(wrapper, '确认接口配置');

    expect(mocks.error).toHaveBeenCalledWith(
      '请选择已定义的查询参数，最多20项',
    );
    expect(mocks.saveOperations).not.toHaveBeenCalled();
  });

  it('编辑查询参数键时表格行标识保持稳定', async () => {
    const source = model();
    const query = source.operationDefinitions?.[0];
    if (!query) throw new Error('测试模型缺少 QUERY 接口');
    source.operationDefinitions = [
      {
        ...query,
        queryInputs: [
          {
            key: 'amount',
            field: 'amount',
            operator: 'EQ',
            title: '金额',
            type: 'MONEY',
            defaultVisible: true,
          },
        ],
      },
    ];
    const wrapper = mountManager(true, source);
    await clickButton(wrapper, '配置');
    const queryTable = wrapper.findAllComponents(TableStub).at(-1);
    if (!queryTable) throw new Error('查询参数表未渲染');
    const rowKey = queryTable.props('rowKey');
    const rows = queryTable.props('dataSource') as
      | Array<{ key: string }>
      | undefined;
    const row = rows?.[0];
    if (typeof rowKey !== 'function' || !row)
      throw new Error('查询参数表缺少稳定行标识');

    const originalId = rowKey(row);
    row.key = 'minimumAmount';
    await flushPromises();

    expect(rowKey(row)).toBe(originalId);
    expect(row.key).toBe('minimumAmount');
  });

  it('扩展动作缺少固定赋值时拒绝应用接口配置', async () => {
    const source = model();
    source.operationDefinitions = [
      {
        code: 'CUSTOM_approve',
        title: '通过',
        classification: 'EXTENSION',
        actionType: 'EXTENSION_UPDATE',
        target: 'RECORD',
        executionType: 'UPDATE_FIELDS',
        enabled: true,
        requestFields: [],
        responseFields: [],
        requestDefinition: { fields: [] },
        responseDefinition: { fields: [] },
        assignments: {},
      },
    ];
    const wrapper = mountManager(true, source);
    await clickButton(wrapper, '配置');
    await clickButton(wrapper, '确认接口配置');

    expect(mocks.error).toHaveBeenCalledWith('请至少定义一个固定赋值');
    expect(mocks.saveOperations).not.toHaveBeenCalled();
  });

  it('扩展动作的布尔固定赋值经配置确认后完整提交', async () => {
    const source = model();
    source.fields = [
      {
        key: 'approved',
        name: 'approved',
        title: '已批准',
        type: 'BOOLEAN',
        nullable: false,
      },
    ];
    source.operationDefinitions = [
      {
        code: 'CUSTOM_approve',
        title: '批准',
        classification: 'EXTENSION',
        actionType: 'EXTENSION_UPDATE',
        target: 'RECORD',
        executionType: 'UPDATE_FIELDS',
        enabled: true,
        requestFields: [],
        responseFields: [],
        requestDefinition: { fields: [] },
        responseDefinition: { fields: [] },
        requestFieldOptions: [
          {
            name: 'approved',
            title: '已批准',
            type: 'BOOLEAN',
            source: 'BUSINESS',
          },
        ],
        assignments: { approved: false },
      },
    ];
    mocks.saveOperations.mockResolvedValue(source);
    const wrapper = mountManager(true, source);
    await clickButton(wrapper, '配置');
    await clickButton(wrapper, '确认接口配置');
    await clickButton(wrapper, '保存接口定义');
    await flushPromises();

    expect(submittedOperation().assignments).toEqual({
      approved: false,
    });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('切换固定赋值字段时表格行标识保持稳定', async () => {
    const source = model();
    source.fields = [
      {
        key: 'approved',
        name: 'approved',
        title: '已批准',
        type: 'BOOLEAN',
        nullable: false,
      },
      {
        key: 'note',
        name: 'note',
        title: '说明',
        type: 'STRING',
        nullable: true,
      },
    ];
    source.operationDefinitions = [
      {
        code: 'CUSTOM_approve',
        title: '批准',
        classification: 'EXTENSION',
        actionType: 'EXTENSION_UPDATE',
        target: 'RECORD',
        executionType: 'UPDATE_FIELDS',
        enabled: true,
        requestFields: [],
        responseFields: [],
        requestDefinition: { fields: [] },
        responseDefinition: { fields: [] },
        assignments: { approved: false },
      },
    ];
    const wrapper = mountManager(true, source);
    await clickButton(wrapper, '配置');
    const assignmentTable = wrapper.findAllComponents(TableStub).at(-1);
    if (!assignmentTable) throw new Error('固定赋值表未渲染');
    const rowKey = assignmentTable.props('rowKey');
    const rows = assignmentTable.props('dataSource') as
      | Array<{ field: string }>
      | undefined;
    const row = rows?.[0];
    if (typeof rowKey !== 'function' || !row)
      throw new Error('固定赋值表缺少稳定行标识');

    const originalId = rowKey(row);
    row.field = 'note';
    await flushPromises();

    expect(rowKey(row)).toBe(originalId);
  });
});
