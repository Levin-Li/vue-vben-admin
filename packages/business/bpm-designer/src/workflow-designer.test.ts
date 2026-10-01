import type { WorkflowTreeVersion } from './workflow-tree-version';

import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import { createTreeDefinition } from './definition-model';
import WorkflowConditionEditor from './workflow-condition-editor.vue';
import WorkflowDesigner from './workflow-designer.vue';
import WorkflowParameterEditor from './workflow-parameter-editor.vue';
import {
  insertGatewayOnTreeEdge,
  insertUserTaskOnTreeEdge,
} from './workflow-tree-edit';
import { projectDraftV3ToV2 } from './workflow-tree-version';

function latest(wrapper: ReturnType<typeof mount>): WorkflowTreeVersion {
  const value = wrapper.emitted('update:modelValue')?.at(-1)?.[0];
  if (!value) throw new Error('没有发出树配置');
  return value as WorkflowTreeVersion;
}

async function openGraph(wrapper: ReturnType<typeof mount>) {
  await wrapper
    .findAll('nav button')
    .find((item) => item.text() === '节点与流转')
    ?.trigger('click');
}

describe('v3 树单源设计器', () => {
  it('新建树修改名称后仅提交 v3 flowTree，不提交平面图', async () => {
    const definition = createTreeDefinition('review', '审核');
    const wrapper = mount(WorkflowDesigner, {
      props: { modelValue: definition },
    });
    await wrapper.get('input').setValue('新名称');
    const edited = latest(wrapper);
    expect(edited).toMatchObject({ schemaVersion: 3, name: '新名称' });
    expect(edited.flowTree.next?.id).toBe('end');
    expect(edited).not.toHaveProperty('nodes');
    expect(edited).not.toHaveProperty('edges');
    expect(definition.name).toBe('审核');
  });

  it('选择稳定连线后原子插入审批节点，原边身份保持不变', async () => {
    const wrapper = mount(WorkflowDesigner, {
      props: { modelValue: createTreeDefinition('review', '审核') },
    });
    await openGraph(wrapper);
    await wrapper.get('[data-edge-id="start_end"]').trigger('click');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '新增审批节点')
      ?.trigger('click');
    const edited = latest(wrapper);
    expect(projectDraftV3ToV2(edited).edges).toMatchObject([
      { id: 'start_end', source: 'start', target: 'userTask_1' },
      { id: 'userTask_1_next_1', source: 'userTask_1', target: 'end' },
    ]);
    expect(edited).not.toHaveProperty('nodes');
    expect(edited).not.toHaveProperty('edges');
  });

  it('选线原子创建排他分支与汇聚；未配齐条件仍可保留草稿但模拟无效', async () => {
    const wrapper = mount(WorkflowDesigner, {
      props: { modelValue: createTreeDefinition('review', '审核') },
    });
    await openGraph(wrapper);
    await wrapper.get('[data-edge-id="start_end"]').trigger('click');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '新增条件分支')
      ?.trigger('click');
    const edited = latest(wrapper);
    expect(edited.schemaVersion).toBe(3);
    expect(edited.flowTree.next?.type).toBe('exclusiveGateway');
    expect(edited.flowTree.next?.branches).toHaveLength(2);
    expect(
      projectDraftV3ToV2(edited).edges?.find((edge) => edge.id === 'start_end')
        ?.target,
    ).toBe(edited.flowTree.next?.id);
    expect(wrapper.emitted('validate')?.at(-1)?.[0]).toBe(false);
  });

  it('节点属性通过稳定 ID 写回树，已发布只读仍可查看属性', async () => {
    const definition = insertUserTaskOnTreeEdge(
      createTreeDefinition('review', '审核'),
      'start_end',
    ).definition;
    const wrapper = mount(WorkflowDesigner, {
      props: { modelValue: definition },
    });
    await openGraph(wrapper);
    expect(
      wrapper.find('[data-flow-design] [aria-label="节点属性"]').exists(),
    ).toBe(true);
    await wrapper.get('[data-node-id="userTask_1"]').trigger('click');
    await wrapper
      .findAll('label')
      .find((item) => item.text().startsWith('节点名称'))
      ?.find('input')
      .setValue('部门审批');
    const edited = latest(wrapper);
    expect(edited.flowTree.next?.name).toBe('部门审批');
    expect(projectDraftV3ToV2(edited).edges?.[0]?.id).toBe('start_end');
    const readonlyWrapper = mount(WorkflowDesigner, {
      props: { modelValue: edited, readonly: true },
    });
    await openGraph(readonlyWrapper);
    await readonlyWrapper
      .get('[aria-label="配置节点 部门审批"]')
      .trigger('click');
    expect(readonlyWrapper.text()).toContain('部门审批');
    expect(
      readonlyWrapper
        .findAll('label')
        .find((item) => item.text().startsWith('节点名称'))
        ?.find('input')
        .attributes('disabled'),
    ).toBeDefined();
    await readonlyWrapper.get('input').trigger('input');
    expect(readonlyWrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('从当前授权目录选择动态审批人并编辑类型化参数，保持树节点与连线 ID', async () => {
    const definition = insertUserTaskOnTreeEdge(
      createTreeDefinition('review', '审核'),
      'start_end',
    ).definition;
    definition.businessBinding = {
      businessType: 'request',
      contractVersion: 2,
      identityField: 'id',
      titleField: 'title',
    };
    const task = definition.flowTree.next;
    if (!task) throw new Error('缺少审批节点');
    task.candidateUsers = ['user:reviewer'];
    const wrapper = mount(WorkflowDesigner, {
      props: {
        modelValue: definition,
        options: {
          businessTypes: [
            {
              businessType: 'request',
              contractVersion: 2,
              title: '申请',
              fields: {},
              approverResolvers: {
                departmentLead: {
                  title: '部门负责人',
                  simulation: true,
                  permission: 'workflow:approver:resolve',
                  parameters: { level: { title: '层级', type: 'integer' } },
                },
                unsafeLead: {
                  title: '未隔离负责人',
                  simulation: false,
                },
              },
            },
          ],
        },
      },
    });
    await openGraph(wrapper);
    await wrapper.get('[data-node-id="userTask_1"]').trigger('click');
    expect(
      wrapper
        .get('[aria-label="动态审批人解析器"]')
        .findAll('option')
        .map((option) => option.text()),
    ).toEqual(['不使用动态审批人', '部门负责人']);
    await wrapper
      .get('[aria-label="动态审批人解析器"]')
      .setValue('departmentLead');
    let edited = latest(wrapper);
    expect(edited.flowTree.next).toMatchObject({
      candidateUsers: ['user:reviewer'],
      approverResolver: { key: 'departmentLead', parameters: {} },
    });
    expect(projectDraftV3ToV2(edited).edges?.[0]?.id).toBe('start_end');
    await wrapper.setProps({ modelValue: edited });
    await wrapper.get('[aria-label="层级参数来源"]').setValue('literal');
    edited = latest(wrapper);
    expect(edited.flowTree.next?.approverResolver?.parameters).toEqual({
      level: { literal: 0 },
    });
    expect(edited).not.toHaveProperty('nodes');
    expect(edited).not.toHaveProperty('edges');
  });

  it('二次验证显示中文名称，定义仍保存后端枚举值', async () => {
    const definition = insertUserTaskOnTreeEdge(
      createTreeDefinition('review', '审核'),
      'start_end',
    ).definition;
    const task = definition.flowTree.next;
    if (!task) throw new Error('缺少审批节点');
    task.stepUpVerifyTypes = ['Sms'];
    const wrapper = mount(WorkflowDesigner, {
      props: { modelValue: definition },
    });
    await openGraph(wrapper);
    await wrapper.get('[data-node-id="userTask_1"]').trigger('click');
    const select = wrapper
      .findAll('label')
      .find((item) => item.text().startsWith('二次验证'))
      ?.get('select');
    expect(
      select
        ?.findAll('option')
        .map((option) => [option.text(), option.attributes('value')]),
    ).toEqual([
      ['图片验证码', 'Captcha'],
      ['人机交互验证', 'Hmi'],
      ['短信验证码', 'Sms'],
      ['邮箱验证码', 'Email'],
      ['多因子验证码', 'Mfa'],
    ]);
    expect(
      (select?.element as HTMLSelectElement).selectedOptions[0]?.value,
    ).toBe('Sms');
  });

  it('结果动作下拉只展示当前契约可隔离模拟的操作', async () => {
    const definition = createTreeDefinition('review', '审核');
    definition.businessBinding = {
      businessType: 'request',
      contractVersion: 2,
      identityField: 'id',
      titleField: 'title',
    };
    definition.startPolicy = {
      mode: 'manual',
      condition: { validator: { key: 'ready' } },
    };
    const wrapper = mount(WorkflowDesigner, {
      props: {
        modelValue: definition,
        options: {
          businessTypes: [
            {
              businessType: 'request',
              contractVersion: 2,
              title: '申请',
              fields: {},
              actions: {
                apply: { title: '回写结果', simulation: true },
                unsafe: { title: '未隔离操作', simulation: false },
              },
              validators: {
                ready: { title: '资料完整', simulation: true },
                unsafe: { title: '未隔离校验', simulation: false },
              },
            },
          ],
        },
      },
    });
    await wrapper
      .findAll('nav button')
      .find((item) => item.text() === '结果处理')
      ?.trigger('click');

    const select = wrapper
      .findAll('label')
      .find((item) => item.text().startsWith('业务操作'))
      ?.get('select');
    expect(select?.findAll('option').map((option) => option.text())).toEqual([
      '选择公开操作',
      '回写结果',
    ]);

    await wrapper
      .findAll('nav button')
      .find((item) => item.text() === '启动与依赖')
      ?.trigger('click');
    expect(
      wrapper
        .get('[aria-label="业务校验器"]')
        .findAll('option')
        .map((option) => option.text()),
    ).toEqual(['选择只读校验器', '资料完整']);
  });

  it('升级候选组使用授权目录展示名，树中仅保存受控组值', async () => {
    const definition = insertUserTaskOnTreeEdge(
      createTreeDefinition('review', '审核'),
      'start_end',
    ).definition;
    const task = definition.flowTree.next;
    if (!task) throw new Error('缺少审批节点');
    task.emptyAssigneePolicy = 'ESCALATE';
    task.escalationCandidateGroups = ['role:reviewer'];
    const wrapper = mount(WorkflowDesigner, {
      props: {
        modelValue: definition,
        options: {
          groups: [
            {
              id: 'reviewer',
              label: '复核角色',
              value: 'role:reviewer',
              kind: 'role',
            },
            {
              id: 'finance',
              label: '财务组织',
              value: 'org:finance',
              kind: 'org',
            },
          ],
        },
      },
    });
    await openGraph(wrapper);
    await wrapper.get('[data-node-id="userTask_1"]').trigger('click');
    const select = wrapper
      .findAll('label')
      .find((item) => item.text().startsWith('升级候选角色 / 组织'))
      ?.get('select');
    expect(
      select
        ?.findAll('option')
        .map((option) => [option.text(), option.attributes('value')]),
    ).toEqual([
      ['复核角色', 'role:reviewer'],
      ['财务组织', 'org:finance'],
    ]);
    if (!select) throw new Error('缺少升级候选组选择器');
    Object.defineProperty(select.element, 'selectedOptions', {
      configurable: true,
      value: [{ value: 'org:finance' }],
    });
    await select.trigger('change');
    expect(latest(wrapper).flowTree.next?.escalationCandidateGroups).toEqual([
      'org:finance',
    ]);
  });

  it('未选边时新增审批和不同结果出口都明确提示', async () => {
    const wrapper = mount(WorkflowDesigner, {
      props: { modelValue: createTreeDefinition('review', '审核') },
    });
    await openGraph(wrapper);
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '新增审批节点')
      ?.trigger('click');
    expect(wrapper.get('[role="alert"]').text()).toContain('请先选择');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '新增不同结果出口')
      ?.trigger('click');
    expect(wrapper.get('[role="alert"]').text()).toContain('唯一入边结束节点');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('选中通向唯一结束节点的边新增双结果出口，原边身份与两种结果保持', async () => {
    const wrapper = mount(WorkflowDesigner, {
      props: { modelValue: createTreeDefinition('review', '审核') },
    });
    await openGraph(wrapper);
    await wrapper.get('[data-edge-id="start_end"]').trigger('click');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '新增不同结果出口')
      ?.trigger('click');
    const edited = latest(wrapper);
    const graph = projectDraftV3ToV2(edited);
    expect(edited).not.toHaveProperty('nodes');
    expect(edited).not.toHaveProperty('edges');
    expect(graph.edges?.find((edge) => edge.id === 'start_end')?.target).toBe(
      edited.flowTree.next?.id,
    );
    expect(
      graph.nodes
        .filter((node) => node.type === 'end')
        .map((node) => node.outcome),
    ).toEqual(['Approved', 'Rejected']);
    await wrapper.setProps({ modelValue: edited });
    expect(wrapper.emitted('validate')?.at(-1)?.[0]).toBe(false);
    expect(wrapper.text()).toContain('拒绝结束');
  });

  it('非结束目标不能插入结果出口，且不会修改树', async () => {
    const definition = insertUserTaskOnTreeEdge(
      createTreeDefinition('review', '审核'),
      'start_end',
    ).definition;
    const wrapper = mount(WorkflowDesigner, {
      props: { modelValue: definition },
    });
    await openGraph(wrapper);
    await wrapper.get('[data-edge-id="start_end"]').trigger('click');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '新增不同结果出口')
      ?.trigger('click');
    expect(wrapper.get('[role="alert"]').text()).toContain(
      '必须指向唯一入边的结束节点',
    );
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('删除普通审批任务用树原子收口，网关删除失败关闭', async () => {
    const definition = insertUserTaskOnTreeEdge(
      createTreeDefinition('review', '审核'),
      'start_end',
    ).definition;
    const wrapper = mount(WorkflowDesigner, {
      props: { modelValue: definition },
    });
    await openGraph(wrapper);
    await wrapper.get('[data-node-id="userTask_1"]').trigger('click');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '删除当前节点')
      ?.trigger('click');
    const edited = latest(wrapper);
    expect(projectDraftV3ToV2(edited).edges).toMatchObject([
      { id: 'start_end', source: 'start', target: 'end' },
    ]);
    expect(
      projectDraftV3ToV2(edited).nodes.some((node) => node.id === 'userTask_1'),
    ).toBe(false);

    const forked = insertGatewayOnTreeEdge(
      createTreeDefinition('review', '审核'),
      'start_end',
      'exclusiveGateway',
    ).definition;
    const gatewayWrapper = mount(WorkflowDesigner, {
      props: { modelValue: forked },
    });
    await openGraph(gatewayWrapper);
    await gatewayWrapper
      .get('[data-node-id="exclusiveGateway_1"]')
      .trigger('click');
    await gatewayWrapper
      .findAll('button')
      .find((item) => item.text() === '删除当前节点')
      ?.trigger('click');
    expect(gatewayWrapper.get('[role="alert"]').text()).toContain(
      '网关及结束节点需要成组结构调整',
    );
    expect(gatewayWrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('旧 v2 图形无法作为 v3 树编辑且不会发出修改', async () => {
    const old = {
      schemaVersion: 2,
      processKey: 'old',
      name: '旧版本',
      nodes: [],
      edges: [],
    } as unknown as WorkflowTreeVersion;
    const wrapper = mount(WorkflowDesigner, { props: { modelValue: old } });
    await openGraph(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      '只接受 schemaVersion=3',
    );
    await wrapper.get('input').setValue('不能编辑');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
});

describe('类型化条件编辑器', () => {
  it('业务操作参数始终使用显式来源，布尔保持类型', async () => {
    const wrapper = mount(WorkflowParameterEditor, {
      props: { parameters: { enabled: { title: '启用', type: 'boolean' } } },
    });
    await wrapper.get('[aria-label="启用参数来源"]').setValue('literal');
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      enabled: { literal: false },
    });
    await wrapper.setProps({ modelValue: { enabled: { literal: false } } });
    await wrapper.get('[aria-label="启用参数值"]').setValue('true');
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      enabled: { literal: true },
    });
  });

  it('布尔 false 以布尔值保存而非字符串', async () => {
    const wrapper = mount(WorkflowConditionEditor, {
      props: {
        modelValue: { eq: [{ variable: 'ready' }, { literal: true }] },
        variables: {
          ready: { source: 'business.ready', type: 'boolean', readAt: 'start' },
        },
      },
    });
    await wrapper.get('[aria-label="条件比较值"]').setValue('false');
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      eq: [{ variable: 'ready' }, { literal: false }],
    });
  });
});
