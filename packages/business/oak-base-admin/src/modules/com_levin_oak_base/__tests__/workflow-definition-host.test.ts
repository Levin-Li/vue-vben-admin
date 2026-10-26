import { flushPromises, mount } from '@vue/test-utils';
import { toRaw } from 'vue';

import { configureDataAttrPolicyLoader } from '@levin/admin-framework/framework-commons/data-attr-policy';
import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Select,
  Table,
} from 'ant-design-vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowDefinitionPage from '../views/workflow-definition/index.vue';

const api = vi.hoisted(() => ({
  denied: new Set<string>(),
  get: vi.fn(),
  request: vi.fn(),
  push: vi.fn(),
  instances: vi.fn(),
  list: vi.fn(),
  versions: vi.fn(),
  retrieve: vi.fn(),
  catalog: vi.fn(),
  candidates: vi.fn(),
  businessObjects: vi.fn(),
  create: vi.fn(),
  createVersion: vi.fn(),
  retire: vi.fn(),
  restore: vi.fn(),
  finishRetire: vi.fn(),
  archive: vi.fn(),
  saveDraft: vi.fn(),
  startSimulation: vi.fn(),
  publishAfterSimulation: vi.fn(),
}));

vi.mock('../api/workflow-definition-service', () => ({
  workflowDefinitionService: {
    list: api.list,
    create: api.create,
    businessObjects: api.businessObjects,
    createBound: async (data: any) => ({
      ...data,
      id: await api.create(data),
      businessType: 'request',
      genericBusinessContract: {
        bindingSnapshot: {
          businessEntityKey: data.businessEntityKey,
          stateField: data.stateField,
          stateType: 'integer',
          stateMapping: data.stateMapping,
        },
      },
    }),
  },
}));
vi.mock('../api/workflow-definition-version-service', () => ({
  workflowDefinitionVersionService: {
    list: api.versions,
    retrieve: api.retrieve,
    create: api.createVersion,
    retire: api.retire,
    restore: api.restore,
    finishRetire: api.finishRetire,
    archive: api.archive,
    saveDraft: api.saveDraft,
    startSimulation: api.startSimulation,
    publishAfterSimulation: api.publishAfterSimulation,
  },
}));
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ push: api.push }),
  useRoute: () => ({
    query: {},
    path: '/workflow-definition',
    fullPath: '/workflow-definition',
    meta: {},
    matched: [],
  }),
}));
vi.mock('../api/workflow-management-service', () => ({
  workflowManagementService: { instances: api.instances },
}));
vi.mock('../api/workflow-runtime-service', () => ({
  workflowRuntimeService: { catalog: api.catalog },
}));
vi.mock('../api/session-directories', () => ({
  getSessionWorkflowCatalog: api.catalog,
}));
vi.mock('../api/workflow-candidate-service', () => ({
  loadWorkflowCandidates: api.candidates,
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({
    hasPermission: (permissions: string[]) =>
      !permissions.some((permission) => api.denied.has(permission)),
  }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  async (original) => ({
    ...(await original<
      typeof import('@levin/admin-framework/framework-commons/shared/crud-permissions')
    >()),
    buildApiMethodPermissions: (_service: unknown, method: string) => [method],
  }),
);
// 保留真实公共 CRUD，仅替换远端策略、展示配置与当前会话边缘。
vi.mock('@vben/runtime/stores', () => ({
  getTabKey: (route: { path: string }) => route.path,
  useAccessStore: () => ({ accessCodes: [] }),
  useTabbarStore: () => ({ setPageKeepAlive: vi.fn() }),
  useUserStore: () => ({ userInfo: { tenantId: 't1' } }),
}));
vi.mock('@levin/admin-framework/framework-commons/runtime', () => ({
  requestClient: {
    get: api.get,
    post: api.request,
    put: api.request,
    request: api.request,
    delete: api.request,
  },
}));
vi.mock('@levin/admin-framework/framework-commons/app/api/request', () => ({
  requestClient: {
    get: api.get,
    post: api.request,
    put: api.request,
    request: api.request,
    delete: api.request,
  },
  baseRequestClient: { get: api.get },
}));
vi.mock('@levin/bpm-designer', async () => {
  const { getLatestWorkflowBusinessType } =
    await import('../../../../../bpm-designer/src/definition-model');
  const { createTaskGraph } =
    await import('../../../../../bpm-designer/src/workflow-task-graph');
  const { createStateGraph } =
    await import('../../../../../bpm-designer/src/workflow-state-graph');
  return {
    getLatestWorkflowBusinessType,
    createStateGraph,
    createTaskGraph,
    workflowLifecycleLabels: {
      Draft: '草稿',
      Testing: '测试中',
      Published: '已发布',
      Retiring: '下线中',
      Retired: '已下线',
      Archived: '已归档',
    },
    createTreeDefinition: (processKey = '', name = '') => ({
      schemaVersion: 3,
      processKey,
      name,
      flowTree: { id: 'start', type: 'start', name: '开始' },
    }),
    WorkflowDefinitionWorkbench: {
      name: 'WorkflowDefinitionWorkbench',
      props: ['version', 'definition', 'options'],
      template: '<div />',
    },
  };
});

function mountPage() {
  return mount(WorkflowDefinitionPage);
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('测试缺少已声明的表单');
  return value;
}

async function fillBinding(model: Record<string, any>) {
  model.businessEntityKey = 'example.Request';
  await flushPromises();
  model.stateField = 'status';
  await flushPromises();
  model.stateMapping = [
    { value: 0, label: '草稿' },
    { value: 1, label: '完成' },
  ];
}

describe('流程设计宿主的版本恢复', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(message, 'error');
    api.denied.clear();
    api.get.mockResolvedValue([]);
    api.request.mockResolvedValue({});
    configureDataAttrPolicyLoader(async () => ({
      version: 1,
      policies: [
        {
          id: 'workflow-definition-read',
          operation: 'list',
          methods: ['GET'],
          pathPatterns: ['/com.levin.oak.base/V1/api/WorkflowDefinition/list'],
          restricted: false,
          groups: [],
          nodes: {},
          requestRoots: [],
          responseRoot: null,
          viewRoots: { request: [], response: [] },
        },
      ],
    }));
    api.createVersion.mockResolvedValue('new-draft');
    api.list.mockResolvedValue({
      items: [
        {
          id: 'definition',
          name: '审批',
          processKey: 'approval',
          businessType: 'workflow-request',
        },
      ],
    });
    api.catalog.mockResolvedValue([]);
    api.candidates.mockResolvedValue({ users: [], groups: [] });
    api.businessObjects.mockResolvedValue([
      {
        entityKey: 'example.Request',
        className: 'example.Request',
        title: '申请',
        provider: 'jpa',
        selectable: true,
        fields: [
          {
            key: 'status',
            title: '状态',
            type: 'integer',
            nullable: false,
            stateFieldAllowed: true,
            manualMappingRequired: true,
            options: [],
          },
        ],
      },
    ]);
    api.versions.mockResolvedValue({
      items: [
        { id: 'older', versionNo: 1, lifecycle: 'Testing' },
        { id: 'latest', versionNo: 2, lifecycle: 'Testing' },
      ],
    });
    api.retrieve.mockImplementation(async ({ id }) => ({
      id,
      lifecycle: 'Testing',
      optimisticLock: 9,
      lowflowDefinition: {
        schemaVersion: 3,
        name: '审批',
        processKey: 'approval',
        flowTree: { id: 'start', type: 'start', name: '开始' },
      },
      simulationReport: { successful: true, runId: `report-${id}` },
    }));
  });

  it('目录加载中和失败不误报为无业务对象，并允许重试', async () => {
    let rejectDirectory!: (error: Error) => void;
    api.businessObjects.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectDirectory = reject;
      }),
    );
    const wrapper = mountPage();
    expect(wrapper.text()).toContain('正在加载可选业务对象');
    expect(wrapper.text()).not.toContain('当前没有可用业务对象');
    api.businessObjects.mockResolvedValue([]);
    rejectDirectory(new Error('网络失败'));
    await flushPromises();
    expect(message.error).toHaveBeenCalledWith(
      expect.stringContaining('业务对象加载失败'),
    );
    expect(wrapper.text()).not.toContain('当前没有可用业务对象');
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '重试加载业务对象')
      ?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('当前没有可用业务对象');
    expect(wrapper.text()).toContain('业务目录未返回可用对象');
    wrapper.unmount();
  });

  it('已发布版本加载失败不会丢弃成功加载的业务对象', async () => {
    api.businessObjects.mockResolvedValue([
      {
        entityKey: 'expense',
        className: 'expense',
        title: '费用申请',
        provider: 'jpa',
        selectable: true,
        fields: [],
      },
    ]);
    api.catalog.mockResolvedValue([
      {
        businessType: 'expense',
        contractVersion: 1,
        title: '费用申请',
        fields: {},
      },
    ]);
    api.versions.mockImplementation(async (query) => {
      if (query.lifecycle === 'Published') throw new Error('版本加载失败');
      return { items: [] };
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(message.error).not.toHaveBeenCalledWith('版本加载失败');
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(message.error).toHaveBeenCalledWith('版本加载失败');
    expect(wrapper.text()).not.toContain('当前没有可用业务对象');
    expect(wrapper.text()).not.toContain('业务对象加载失败');
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '新建流程')
      ?.trigger('click');
    await flushPromises();
    expect(
      wrapper
        .findAllComponents(Select)
        .some((select) =>
          select.props('options')?.some((option) => option.value === 'expense'),
        ),
    ).toBe(true);
    wrapper.unmount();
  });

  it('新建流程列出不可绑定 JPA 对象并显示原因', async () => {
    api.businessObjects.mockResolvedValue([
      {
        entityKey: 'example.Account',
        className: 'example.Account',
        title: '账号资料',
        provider: 'jpa',
        selectable: false,
        unavailableReason: '当前账号没有该对象列表或详情权限',
        fields: [],
      },
    ]);
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '新建流程')
      ?.trigger('click');
    await flushPromises();
    const option = wrapper
      .findAllComponents(Select)
      .flatMap((select) => select.props('options') || [])
      .find((item) => item.value === 'example.Account');
    expect(option?.disabled).toBe(true);
    expect(option?.label).toContain('当前账号没有该对象列表或详情权限');
    wrapper.unmount();
  });

  it('业务设计者新建流程先绑定业务对象和状态字段', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '新建流程')
      ?.trigger('click');
    await flushPromises();
    expect(
      required(
        wrapper
          .findAllComponents(Form)
          .find((form) => form.props('name') === 'workflowDefinitionCreate'),
      ).props('model'),
    ).toEqual({
      name: '',
      businessType: '',
      businessEntityKey: '',
      stateField: '',
      stateMapping: [],
    });
    expect(wrapper.text()).not.toContain('流程标识');
    wrapper.unmount();
  });

  it('保存新流程时由系统生成稳定键，不从表单索取技术标识', async () => {
    api.create.mockResolvedValue('new-definition');
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '新建流程')
      ?.trigger('click');
    const form = required(
      wrapper
        .findAllComponents(Form)
        .find((form) => form.props('name') === 'workflowDefinitionCreate'),
    );
    const formModel = form.props('model');
    if (!formModel) throw new Error('缺少新建流程表单');
    Object.assign(formModel, {
      name: '请假审批',
      businessType: 'workflow-request',
    });
    await fillBinding(formModel);
    form.vm.$emit('finish', formModel);
    await flushPromises();

    expect(api.createVersion).toHaveBeenCalledWith({
      workflowDefinitionId: 'new-definition',
      versionNo: 1,
      lowflowDefinition: expect.objectContaining({
        schemaVersion: 5,
        businessBinding: expect.objectContaining({
          businessEntityKey: 'example.Request',
          stateField: 'status',
        }),
      }),
    });
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('version').id,
    ).toBe('new-draft');
    expect(
      required(
        wrapper
          .findAllComponents(Modal)
          .find((item) => item.props('width') === 'calc(100vw - 32px)'),
      ).props('open'),
    ).toBe(true);
    expect(api.create).toHaveBeenCalledWith({
      name: '请假审批',
      businessEntityKey: 'example.Request',
      stateField: 'status',
      stateMapping: [
        { value: 0, label: '草稿' },
        { value: 1, label: '完成' },
      ],
      processKey: expect.stringMatching(/^workflow-[\da-f-]+$/),
    });
    wrapper.unmount();
  });

  it('关闭设计面板不加载编辑候选，首次打开加载并在重新打开后复用空结果', async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(api.candidates).not.toHaveBeenCalled();
    expect(
      api.versions.mock.calls.some(
        ([query]) => query.lifecycle === 'Published',
      ),
    ).toBe(false);

    const openDesign = async () => {
      await wrapper
        .findAllComponents(Button)
        .find((button) => button.text() === '打开设计')
        ?.trigger('click');
      await flushPromises();
    };
    await openDesign();
    expect(api.candidates).toHaveBeenCalledExactlyOnceWith('');
    expect(
      api.versions.mock.calls.filter(
        ([query]) => query.lifecycle === 'Published',
      ),
    ).toHaveLength(1);
    const designer = required(
      wrapper
        .findAllComponents(Modal)
        .find((item) => item.props('width') === 'calc(100vw - 32px)'),
    );
    designer.vm.$emit('cancel');
    await flushPromises();
    await openDesign();
    expect(api.candidates).toHaveBeenCalledTimes(1);
    expect(
      api.versions.mock.calls.filter(
        ([query]) => query.lifecycle === 'Published',
      ),
    ).toHaveLength(1);
    wrapper.unmount();
  });

  it('候选尚未返回时关闭重开合并同一个页面的请求', async () => {
    let resolveCandidates!: (value: { groups: []; users: [] }) => void;
    api.candidates.mockReturnValue(
      new Promise((resolve) => {
        resolveCandidates = resolve;
      }),
    );
    const wrapper = mountPage();
    await flushPromises();
    const open = async () => {
      await wrapper
        .findAllComponents(Button)
        .find((button) => button.text() === '打开设计')
        ?.trigger('click');
      await flushPromises();
    };
    await open();
    const designer = required(
      wrapper
        .findAllComponents(Modal)
        .find((item) => item.props('width') === 'calc(100vw - 32px)'),
    );
    designer.vm.$emit('cancel');
    await flushPromises();
    await open();
    expect(api.candidates).toHaveBeenCalledTimes(1);
    resolveCandidates({ users: [], groups: [] });
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('options').users,
    ).toEqual([]);
    wrapper.unmount();
  });

  it('编辑候选首次打开后进入真实设计选项', async () => {
    api.candidates.mockResolvedValue({
      users: [{ id: 'u1', label: '用户甲', kind: 'user' }],
      groups: [{ id: 'r1', label: '角色甲', value: 'role:r1', kind: 'role' }],
    });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    const options = wrapper
      .findComponent({ name: 'WorkflowDefinitionWorkbench' })
      .props('options');
    expect(options.users).toEqual([
      { id: 'u1', label: '用户甲', kind: 'user' },
    ]);
    expect(options.groups).toEqual([
      { id: 'r1', label: '角色甲', value: 'role:r1', kind: 'role' },
    ]);
    wrapper.unmount();
  });

  it('设计在接近全屏弹窗打开，关闭重开保留未保存草稿且不重新取详情', async () => {
    const wrapper = mountPage();
    await flushPromises();
    const designer = required(
      wrapper
        .findAllComponents(Modal)
        .find((item) => item.props('width') === 'calc(100vw - 32px)'),
    );
    expect(designer.props('open')).toBe(false);
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(designer.props('open')).toBe(true);
    expect(designer.props('footer')).toBeNull();
    expect(designer.props('destroyOnClose')).toBe(false);
    expect(designer.props('bodyStyle')).toMatchObject({
      height: 'calc(100dvh - 104px)',
      overflow: 'auto',
    });
    const workbench = wrapper.findComponent({
      name: 'WorkflowDefinitionWorkbench',
    });
    const edited = structuredClone(toRaw(workbench.props('definition')));
    edited.name = '未保存的名称';
    workbench.vm.$emit('update:definition', edited);
    await flushPromises();
    designer.vm.$emit('cancel');
    await flushPromises();
    expect(designer.props('open')).toBe(false);
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(designer.props('open')).toBe(true);
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('definition').name,
    ).toBe('未保存的名称');
    expect(api.retrieve).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('选择定义时通过详情恢复最新版本模拟报告，不使用列表摘要发布', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(api.retrieve).toHaveBeenCalledWith({ id: 'latest' });
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('version'),
    ).toMatchObject({
      id: 'latest',
      optimisticLock: 9,
      simulationReport: { successful: true, runId: 'report-latest' },
    });
    wrapper.unmount();
  });

  it('从当前选中的已保存版本复制完整设计，不复制部署或模拟证明', async () => {
    const saved = {
      schemaVersion: 3,
      name: '双分支复核',
      processKey: 'approval',
      purposeKey: 'expense-review',
      businessBinding: {
        businessType: 'workflow-expense',
        contractVersion: '1',
        identityField: 'id',
        titleField: 'title',
      },
      flowTree: {
        id: 'start',
        type: 'start',
        name: '开始',
        notifications: [
          {
            event: 'NodeEntered',
            recipient: 'applicant',
            channels: ['Station'],
            title: '流程通知',
            content: '# {{process.name}}',
          },
        ],
        next: {
          id: 'review',
          type: 'userTask',
          name: '财务核验',
          formAction: 'verify',
          readableFields: ['amount'],
          editableFields: ['verifiedAmount'],
          next: {
            id: 'branch',
            type: 'exclusiveGateway',
            name: '金额分支',
            branches: [
              {
                id: 'large',
                condition: { gt: [{ variable: 'amount' }, { literal: 1000 }] },
              },
            ],
          },
        },
      },
    };
    api.retrieve.mockImplementation(async ({ id }) => ({
      id,
      lifecycle: id === 'new-draft' ? 'Draft' : 'Published',
      versionNo: id === 'older' ? 1 : 2,
      lowflowDefinition:
        id === 'older' ? saved : { ...saved, name: '另一个版本' },
      bpmnXml: '<definitions />',
      simulationReport: { successful: true, runId: 'old-proof' },
    }));
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    wrapper
      .findAllComponents(Select)
      .find((select) => select.attributes('aria-label') === '选择流程版本')
      ?.vm.$emit('change', 'older');
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '新建草稿版本')
      ?.trigger('click');
    await flushPromises();
    expect(api.createVersion).toHaveBeenCalledWith({
      workflowDefinitionId: 'definition',
      versionNo: 3,
      lowflowDefinition: saved,
    });
    const request = api.createVersion.mock.calls[0]?.[0];
    expect(request.lowflowDefinition).not.toBe(saved);
    expect(request).not.toHaveProperty('bpmnXml');
    expect(request).not.toHaveProperty('simulationReport');
    wrapper.unmount();
  });

  it('确认放弃未保存修改后复制持久化版本，取消时不创建', async () => {
    const confirm = vi
      .spyOn(Modal, 'confirm')
      .mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    const workbench = wrapper.findComponent({
      name: 'WorkflowDefinitionWorkbench',
    });
    const saved = structuredClone(toRaw(workbench.props('definition')));
    workbench.vm.$emit('update:definition', {
      ...saved,
      name: '尚未保存的修改',
    });
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '新建草稿版本')
      ?.trigger('click');
    await flushPromises();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(api.createVersion).not.toHaveBeenCalled();
    confirm.mock.calls[0]?.[0].onCancel?.();
    await flushPromises();
    expect(api.createVersion).not.toHaveBeenCalled();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '新建草稿版本')
      ?.trigger('click');
    await flushPromises();
    confirm.mock.calls[1]?.[0].onOk?.();
    await flushPromises();
    expect(api.createVersion).toHaveBeenCalledWith({
      workflowDefinitionId: 'definition',
      versionNo: 3,
      lowflowDefinition: saved,
    });
    expect(api.createVersion.mock.calls[0]?.[0].lowflowDefinition.name).toBe(
      '审批',
    );
    confirm.mockRestore();
    wrapper.unmount();
  });

  it('首次草稿继承业务对象并自动预填用途与字段角色', async () => {
    api.catalog.mockResolvedValue([
      {
        businessType: 'workflow-request',
        contractVersion: '2',
        title: '业务申请',
        fields: {},
        defaultBinding: {
          identityField: 'id',
          titleField: 'title',
          applicantField: 'ownerId',
        },
      },
    ]);
    api.retrieve.mockResolvedValueOnce({
      id: 'latest',
      lifecycle: 'Draft',
      optimisticLock: 1,
    });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('definition'),
    ).toMatchObject({
      purposeKey: 'approval',
      businessBinding: {
        businessType: 'workflow-request',
        contractVersion: '2',
        identityField: 'id',
        titleField: 'title',
        applicantField: 'ownerId',
      },
    });
    wrapper.unmount();
  });

  it('全新草稿在多个业务方案中默认采用最新契约', async () => {
    api.catalog.mockResolvedValue(
      [1, 2].map((contractVersion) => ({
        businessType: 'workflow-request',
        contractVersion,
        title: '业务申请',
        fields: {},
        defaultBinding: { identityField: 'id', titleField: 'title' },
      })),
    );
    api.retrieve.mockResolvedValueOnce({
      id: 'latest',
      lifecycle: 'Draft',
      optimisticLock: 1,
    });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('definition').businessBinding,
    ).toMatchObject({
      contractVersion: 2,
      identityField: 'id',
      titleField: 'title',
    });
    expect(wrapper.findComponent(Card).text()).toContain(
      '发起前请确认流程已发布、业务记录满足启动条件',
    );
    expect(wrapper.findComponent(Card).text()).toContain(
      '实例的租户和组织跟随业务记录',
    );
    wrapper.unmount();
  });

  it('已有持久化设计保留历史契约，不被新目录升级', async () => {
    api.catalog.mockResolvedValue(
      [1, 2].map((contractVersion) => ({
        businessType: 'workflow-request',
        contractVersion,
        title: '业务申请',
        fields: {},
        defaultBinding: { identityField: 'id', titleField: 'title' },
      })),
    );
    api.retrieve.mockResolvedValueOnce({
      id: 'latest',
      lifecycle: 'Draft',
      lowflowDefinition: {
        schemaVersion: 3,
        processKey: 'approval',
        name: '历史审核',
        businessBinding: {
          businessType: 'workflow-request',
          contractVersion: 1,
          identityField: 'id',
          titleField: 'title',
        },
        flowTree: { id: 'start', type: 'start', name: '开始' },
      },
    });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('definition').businessBinding.contractVersion,
    ).toBe(1);
    expect(api.saveDraft).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('当前流程用途不进入自己的前置流程候选', async () => {
    api.versions.mockImplementation(async (query) =>
      query.lifecycle === 'Published'
        ? {
            items: [
              {
                id: 'current-published',
                lowflowDefinition: {
                  schemaVersion: 3,
                  purposeKey: 'approval',
                  name: '当前审核',
                  businessBinding: { businessType: 'workflow-request' },
                },
              },
              {
                id: 'prior-published',
                lowflowDefinition: {
                  schemaVersion: 3,
                  purposeKey: 'prior-review',
                  name: '资料复核',
                  businessBinding: { businessType: 'workflow-request' },
                },
              },
            ],
          }
        : { items: [{ id: 'draft', versionNo: 3, lifecycle: 'Draft' }] },
    );
    api.retrieve.mockResolvedValueOnce({
      id: 'draft',
      lifecycle: 'Draft',
      optimisticLock: 1,
      lowflowDefinition: {
        schemaVersion: 3,
        name: '当前审核',
        processKey: 'approval',
        purposeKey: 'approval',
        flowTree: { id: 'start', type: 'start', name: '开始' },
      },
    });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();

    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('options').purposeOptions,
    ).toEqual([{ label: '资料复核', value: 'prior-review' }]);
    wrapper.unmount();
  });

  it('切换版本重新加载该版本详情与报告', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    wrapper
      .findAllComponents(Select)
      .find((select) => select.attributes('aria-label') === '选择流程版本')
      ?.vm.$emit('change', 'older');
    await flushPromises();
    expect(api.retrieve).toHaveBeenLastCalledWith({ id: 'older' });
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('version').simulationReport.runId,
    ).toBe('report-older');
    wrapper.unmount();
  });

  it('旧版平面图详情失败关闭，不自动转换或回填为树', async () => {
    api.retrieve.mockResolvedValueOnce({
      id: 'latest',
      lifecycle: 'Testing',
      lowflowDefinition: { schemaVersion: 2, nodes: [], edges: [] },
    });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();

    expect(message.error).toHaveBeenCalledWith(
      '此版本不是受支持的流程设计格式。',
    );
    expect(
      wrapper.findComponent({ name: 'WorkflowDefinitionWorkbench' }).exists(),
    ).toBe(false);
    expect(api.saveDraft).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('第四版列表显示实体中文名和状态字段说明，查询将实体键与第三版类型分别传递', async () => {
    api.list.mockResolvedValue({
      items: [
        {
          id: 'bound',
          name: '实体审批',
          processKey: 'entity_review',
          businessType: 'state-bound',
          businessEntityKey: 'example.Request',
          stateField: 'status',
        },
      ],
    });
    api.catalog.mockResolvedValue([
      {
        businessType: 'example.Request',
        contractVersion: 1,
        title: '旧申请',
        fields: {},
      },
      {
        businessType: 'state-bound',
        contractVersion: 1,
        title: '内部标识',
        fields: {},
      },
    ]);
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).not.toContain('state-bound');
    expect(
      wrapper.find('span[title="example.Request · 状态（status）"]').text(),
    ).toBe('申请');
    const selector = wrapper
      .findAllComponents(Select)
      .find((select) => select.props('placeholder') === '全部业务对象');
    expect(selector?.props('options')).toEqual([
      { label: '申请', value: 'entity:example.Request' },
      { label: '旧申请（第三版）', value: 'legacy:example.Request' },
    ]);
    selector?.vm.$emit('update:value', 'entity:example.Request');
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text().replaceAll(' ', '') === '查询')
      ?.trigger('click');
    await flushPromises();
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ businessEntityKey: 'example.Request' }),
    );
    expect(api.list.mock.calls.at(-1)?.[0]).not.toHaveProperty('businessType');
    selector?.vm.$emit('update:value', 'legacy:example.Request');
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text().replaceAll(' ', '') === '查询')
      ?.trigger('click');
    await flushPromises();
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ businessType: 'example.Request' }),
    );
    expect(api.list.mock.calls.at(-1)?.[0]).not.toHaveProperty(
      'businessEntityKey',
    );
    wrapper.unmount();
  });
  it('通过服务端分页和名称查询管理定义，显示全局与租户归属', async () => {
    api.list.mockResolvedValue({
      items: [
        {
          id: 'global',
          name: '全局审批',
          businessType: 'request',
          processKey: 'global',
        },
        {
          id: 'tenant',
          name: '租户审批',
          businessType: 'request',
          processKey: 'tenant',
          tenantId: 'tenant-a',
          tenantName: '甲公司',
        },
      ],
      totals: 250,
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('全局');
    expect(wrapper.text()).toContain('租户：甲公司');
    expect(wrapper.findComponent(Table).props('pagination')).toEqual(
      expect.objectContaining({ total: 250 }),
    );
    wrapper
      .findComponent(Table)
      .vm.$emit('change', { current: 3, pageSize: 20 });
    await flushPromises();
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageIndex: 3, pageSize: 20 }),
    );
    wrapper.findAllComponents(Input)[0]?.vm.$emit('update:value', '审批');
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text().replaceAll(' ', '') === '查询')
      ?.trigger('click');
    await flushPromises();
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageIndex: 1, containsName: '审批' }),
    );
    wrapper.unmount();
  });

  it('首草稿创建失败保留定义并允许重试，不重复创建定义', async () => {
    api.create.mockResolvedValue('created-definition');
    api.createVersion.mockRejectedValueOnce(new Error('暂时不可用'));
    api.versions.mockResolvedValue({ items: [] });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '新建流程')
      ?.trigger('click');
    const form = required(
      wrapper
        .findAllComponents(Form)
        .find((form) => form.props('name') === 'workflowDefinitionCreate'),
    );
    const model = form.props('model');
    if (!model) throw new Error('缺少流程表单');
    Object.assign(model, {
      name: '新审批',
      businessType: 'request',
    });
    await fillBinding(model);
    form.vm.$emit('finish');
    await flushPromises();
    expect(message.error).toHaveBeenCalledWith(
      expect.stringContaining('流程定义已创建，首个草稿创建失败'),
    );
    expect(
      wrapper
        .findAllComponents(Modal)
        .some((item) => item.props('title') === '新审批 · 流程设计'),
    ).toBe(true);
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '新建草稿版本')
      ?.trigger('click');
    await flushPromises();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.createVersion).toHaveBeenLastCalledWith({
      workflowDefinitionId: 'created-definition',
      versionNo: 1,
      lowflowDefinition: expect.objectContaining({ schemaVersion: 5 }),
    });
    expect(
      wrapper.findComponent({ name: 'WorkflowDefinitionWorkbench' }).exists(),
    ).toBe(true);
    wrapper.unmount();
  });

  it('版本历史超过200条仍加载全部并打开真正最新版本', async () => {
    api.versions.mockImplementation(async (query) => {
      if (query.lifecycle) return { items: [] };
      const start = ((query.pageIndex ?? 1) - 1) * query.pageSize;
      return {
        items: Array.from(
          { length: Math.min(query.pageSize, 205 - start) },
          (_, index) => ({
            id: `v-${start + index + 1}`,
            versionNo: start + index + 1,
            lifecycle: 'Draft',
          }),
        ),
        totals: 205,
      };
    });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(api.retrieve).toHaveBeenLastCalledWith({ id: 'v-205' });
    expect(api.versions).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 5, pageSize: 50 }),
    );
    wrapper.unmount();
  });

  it('只显示服务端支持的版本生命周期操作', async () => {
    api.retrieve.mockResolvedValue({
      id: 'latest',
      lifecycle: 'Retiring',
      supportEventsByCurrentStatus: ['恢复上线', '完成下线'],
    });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    const buttons = wrapper
      .findAllComponents(Button)
      .map((button) => button.text());
    expect(buttons).toContain('恢复上线');
    expect(buttons).toContain('完成下线');
    expect(buttons).not.toContain('归档');
    expect(buttons).not.toContain('开始下线');
    wrapper.unmount();
  });
  it('支持事件不能代替实际API权限，缺少权限时隐藏操作', async () => {
    api.denied.add('retire');
    api.retrieve.mockResolvedValue({
      id: 'latest',
      lifecycle: 'Published',
      supportEventsByCurrentStatus: ['开始下线'],
    });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(
      wrapper.findAllComponents(Button).map((button) => button.text()),
    ).not.toContain('开始下线');
    expect(api.retire).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('运行实例入口携带当前定义筛选进入管理页', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '运行实例')
      ?.trigger('click');
    expect(api.push).toHaveBeenCalledWith({
      path: '/clob/V1/WorkflowInstance',
      query: { definitionId: 'definition' },
    });
    wrapper.unmount();
  });

  it('没有独立管理查询权限时不显示运行实例入口', async () => {
    api.denied.add('instances');
    const wrapper = mountPage();
    await flushPromises();
    expect(
      wrapper.findAllComponents(Button).map((button) => button.text()),
    ).not.toContain('运行实例');
    expect(api.push).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('首草稿已经创建但详情失败时保留版本选择以恢复设计', async () => {
    api.create.mockResolvedValue('created-definition');
    api.retrieve.mockRejectedValueOnce(new Error('详情暂时不可用'));
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '新建流程')
      ?.trigger('click');
    const form = required(
      wrapper
        .findAllComponents(Form)
        .find((form) => form.props('name') === 'workflowDefinitionCreate'),
    );
    const model = form.props('model');
    if (!model) throw new Error('缺少流程表单');
    Object.assign(model, { name: '新审批', businessType: 'request' });
    await fillBinding(model);
    form.vm.$emit('finish');
    await flushPromises();
    expect(message.error).toHaveBeenCalledWith(
      expect.stringContaining('草稿版本已创建，但打开失败'),
    );
    wrapper
      .findAllComponents(Select)
      .find((select) => select.attributes('aria-label') === '选择流程版本')
      ?.vm.$emit('change', 'new-draft');
    await flushPromises();
    expect(
      wrapper.findComponent({ name: 'WorkflowDefinitionWorkbench' }).exists(),
    ).toBe(true);
    expect(api.createVersion).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('真实公共列表禁用普通写入与导出，保留专用设计和实例操作', async () => {
    const wrapper = mountPage();
    await flushPromises();
    const config = wrapper.findComponent(CrudPage).props('config');
    expect(config).toMatchObject({
      apiBase: '/WorkflowDefinition',
      allowCreate: false,
      allowEdit: false,
      allowDelete: false,
      allowRetrieve: false,
      allowExport: false,
      queryPermission: ['list'],
      dataAttrTargets: {
        list: {
          method: 'GET',
          path: '/com.levin.oak.base/V1/api/WorkflowDefinition/list',
        },
      },
    });
    expect(
      config.fields.find((field) => field.key === 'containsName'),
    ).toMatchObject({ search: true, table: false });
    expect(
      config.fields.find((field) => field.key === 'businessObject')?.options,
    ).toContainEqual({ label: '申请', value: 'entity:example.Request' });
    expect(
      wrapper
        .findAllComponents(Button)
        .some((item) => item.text() === '新建流程'),
    ).toBe(true);
    const calls = api.list.mock.calls.length;
    await wrapper.findComponent(CrudPage).vm.reload();
    await flushPromises();
    expect(api.list.mock.calls.length).toBe(calls + 1);
    wrapper.unmount();
  });

  it('缺少列表权限时公共页面不发列表或版本摘要请求', async () => {
    api.denied.add('list');
    const wrapper = mountPage();
    await flushPromises();
    expect(api.list).not.toHaveBeenCalled();
    expect(api.versions).not.toHaveBeenCalled();
    expect(
      wrapper.findAllComponents(Button).map((item) => item.text()),
    ).not.toContain('打开设计');
    wrapper.unmount();
  });

  it('版本摘要失败保留真实定义列表并明确显示失败', async () => {
    api.versions.mockImplementation(async (query) => {
      if (query.workflowDefinitionId) throw new Error('摘要暂不可用');
      return { items: [] };
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(message.error).toHaveBeenCalledWith('摘要暂不可用');
    expect(wrapper.text()).toContain('版本加载失败');
    expect(wrapper.findComponent(Table).props('dataSource')).toHaveLength(1);
    expect(
      wrapper.findAllComponents(Button).map((item) => item.text()),
    ).toContain('打开设计');
    wrapper.unmount();
  });

  it('重叠刷新时迟到的版本摘要不能覆盖最新列表摘要', async () => {
    let resolveOld!: (value: unknown) => void;
    let first = true;
    api.versions.mockImplementation(async (query) => {
      if (!query.workflowDefinitionId) return { items: [] };
      if (first) {
        first = false;
        return new Promise((resolve) => {
          resolveOld = resolve;
        });
      }
      return { items: [{ id: 'new', versionNo: 9, lifecycle: 'Published' }] };
    });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.findComponent(CrudPage).vm.reload();
    await flushPromises();
    expect(wrapper.text()).toContain('最新：版本 9 · 已发布');
    resolveOld({ items: [{ id: 'old', versionNo: 1, lifecycle: 'Draft' }] });
    await flushPromises();
    expect(wrapper.text()).toContain('最新：版本 9 · 已发布');
    expect(wrapper.text()).not.toContain('最新：版本 1 · 草稿');
    wrapper.unmount();
  });
});
