import type {
  WorkflowCondition,
  WorkflowDesignerDefinition,
  WorkflowDesignerOptions,
  WorkflowNode,
  WorkflowNodeType,
} from './types';

import { applyGraphLayout, hasAutomaticLayout } from './workflow-graph-layout';

/** JSON对象键的序列化顺序不影响业务配置，数组顺序仍保留节点与动作语义。 */
export function definitionFingerprint(value: unknown): string {
  function canonical(item: unknown): unknown {
    if (Array.isArray(item)) return item.map((entry) => canonical(entry));
    if (item && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item)
          .toSorted(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, canonical(entry)]),
      );
    return item;
  }
  return JSON.stringify(canonical(value)) ?? '';
}

/** 新定义直接使用显式图，避免把节点排列顺序误当执行线路。 */
export function createDefinition(
  processKey = '',
  name = '',
): WorkflowDesignerDefinition {
  return {
    schemaVersion: 2,
    processKey,
    name,
    purposeKey: '',
    variables: {},
    startPolicy: { mode: 'manual', priority: 0 },
    outcomeActions: {},
    nodes: [
      { id: 'start', name: '开始', type: 'start', x: 60, y: 100 },
      {
        id: 'end',
        name: '通过结束',
        type: 'end',
        outcome: 'Approved',
        x: 380,
        y: 100,
      },
    ],
    edges: [{ id: 'start_end', source: 'start', target: 'end' }],
  };
}

/** 删除后也通过实际节点集合分配标识，避免计数复用导致覆盖。 */
export function addNode(
  definition: WorkflowDesignerDefinition,
  type: WorkflowNodeType,
): WorkflowNode {
  const automatic = hasAutomaticLayout(definition);
  let index = 1;
  while (definition.nodes.some((node) => node.id === `${type}_${index}`))
    index++;
  const labels = {
    userTask: '审批',
    exclusiveGateway: '条件分支',
    parallelGateway: '并行网关',
    end: '结束',
    start: '开始',
  };
  const node: WorkflowNode = {
    id: `${type}_${index}`,
    type,
    name: `${labels[type]} ${index}`,
    x: 60 + (definition.nodes.length % 3) * 260,
    y: 100 + Math.floor(definition.nodes.length / 3) * 130,
    ...(type === 'userTask'
      ? {
          actions: ['approve', 'reject'],
          candidateUsers: [],
          candidateGroups: [],
          multiApprovalMode: 'NONE' as const,
          allowSelfApproval: false,
        }
      : {}),
    ...(type === 'end' ? { outcome: 'Approved' } : {}),
  };
  definition.nodes.push(node);
  definition.edges ??= [];
  const edge = definition.edges.find(
    (item) =>
      definition.nodes.find((candidate) => candidate.id === item.target)
        ?.type === 'end',
  );
  if (edge && type !== 'end') {
    const target = edge.target;
    edge.target = node.id;
    definition.edges.push({
      id: `${node.id}_${target}`,
      source: node.id,
      target,
    });
  }
  if (automatic) applyGraphLayout(definition);
  return node;
}

/** 节点删除同时清理悬空线路；单入单出的节点保持原串行连接。 */
export function removeNode(definition: WorkflowDesignerDefinition, id: string) {
  if (definition.nodes.find((node) => node.id === id)?.type === 'start') return;
  const incoming = definition.edges?.filter((edge) => edge.target === id) ?? [];
  const outgoing = definition.edges?.filter((edge) => edge.source === id) ?? [];
  definition.nodes = definition.nodes.filter((node) => node.id !== id);
  definition.edges =
    definition.edges?.filter(
      (edge) => edge.source !== id && edge.target !== id,
    ) ?? [];
  if (
    incoming.length === 1 &&
    outgoing.length === 1 &&
    incoming[0] &&
    outgoing[0]
  )
    definition.edges.push({ ...incoming[0], target: outgoing[0].target });
}

/** 本地校验提供定位提示；权限、条件类型与引擎支持仍须服务端复核。 */
export function validateDefinition(
  definition: WorkflowDesignerDefinition,
  options: WorkflowDesignerOptions = {},
): string[] {
  const messages: string[] = [];
  if (!definition.name.trim()) messages.push('请填写流程名称。');
  if (!definition.processKey.trim()) messages.push('请填写流程标识。');
  if (!definition.purposeKey?.trim()) messages.push('请填写业务用途标识。');
  const binding = definition.businessBinding;
  if (!binding) messages.push('请选择业务对象并配置字段映射。');
  const business = options.businessTypes?.find(
    (item) =>
      item.businessType === binding?.businessType &&
      String(item.contractVersion) === String(binding?.contractVersion),
  );
  if (binding && options.businessTypes && !business)
    messages.push('当前业务契约不在可用目录中。');
  if (binding) {
    for (const key of ['identityField', 'titleField'] as const) {
      if (!binding[key])
        messages.push(
          `请配置${key === 'identityField' ? '业务主键' : '业务标题'}字段。`,
        );
    }
    if (business) {
      for (const field of [
        binding.identityField,
        binding.titleField,
        binding.applicantField,
        binding.summaryField,
      ].filter(Boolean)) {
        if (field && !business.fields[field])
          messages.push(`映射字段「${field}」不在业务能力目录中。`);
      }
      for (const [name, variable] of Object.entries(
        definition.variables ?? {},
      )) {
        const field =
          business.fields[variable.source.replace(/^business\./, '')];
        if (
          !variable.source.startsWith('business.') ||
          !field?.condition ||
          field.sensitivity === 'secret' ||
          field.type !== variable.type
        )
          messages.push(`变量「${name}」来源或类型与业务契约不匹配。`);
      }
    }
  }
  if (definition.nodes.filter((node) => node.type === 'start').length !== 1)
    messages.push('流程必须包含一个开始节点。');
  if (!definition.nodes.some((node) => node.type === 'end'))
    messages.push('流程至少包含一个结束节点。');
  const ids = new Set(definition.nodes.map((node) => node.id));
  if (ids.size !== definition.nodes.length) messages.push('节点标识不能重复。');
  const edgeIds = new Set((definition.edges ?? []).map((edge) => edge.id));
  if (edgeIds.size !== definition.edges?.length)
    messages.push('连线标识不能重复。');
  for (const edge of definition.edges ?? []) {
    if (!ids.has(edge.source) || !ids.has(edge.target))
      messages.push(`连线「${edge.id}」引用了不存在的节点。`);
    if (edge.source === edge.target)
      messages.push(`连线「${edge.id}」不能指向自身。`);
  }
  const reached = new Set(
    definition.nodes
      .filter((node) => node.type === 'start')
      .map((node) => node.id),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of definition.edges ?? []) {
      if (reached.has(edge.source) && !reached.has(edge.target)) {
        reached.add(edge.target);
        changed = true;
      }
    }
  }
  for (const node of definition.nodes) {
    if (!/^[A-Z_]\w{0,63}$/i.test(node.id))
      messages.push(`节点「${node.name}」标识格式非法。`);
    if (!reached.has(node.id))
      messages.push(`节点「${node.name}」无法从开始节点到达。`);
    const outgoing =
      definition.edges?.filter((edge) => edge.source === node.id) ?? [];
    if (node.type !== 'end' && outgoing.length === 0)
      messages.push(`节点「${node.name}」缺少后续连线。`);
    if (
      node.type === 'userTask' &&
      !(node.candidateUsers?.length || node.candidateGroups?.length)
    )
      messages.push(`节点「${node.name}」缺少候选用户或候选组。`);
    if (node.type === 'userTask' && !node.actions?.length)
      messages.push(`节点「${node.name}」缺少允许动作。`);
    if (
      node.type === 'exclusiveGateway' &&
      outgoing.length > 1 &&
      outgoing.some((edge) => !edge.default && !edge.condition)
    )
      messages.push(`条件分支「${node.name}」存在未配置条件的连线。`);
    if (outgoing.filter((edge) => edge.default).length > 1)
      messages.push(`节点「${node.name}」只能有一条默认连线。`);
    if (node.type === 'userTask') {
      if (
        node.reminderMinutes &&
        (!node.deadlineMinutes || node.reminderMinutes >= node.deadlineMinutes)
      )
        messages.push(`节点「${node.name}」提前催办时间必须小于节点时限。`);
      if (node.editableFields?.length) {
        const action = business?.actions?.[node.formAction ?? ''];
        if (!action)
          messages.push(
            `节点「${node.name}」可编辑表单必须绑定已公开的保存业务操作。`,
          );
        for (const key of node.editableFields) {
          const field = business?.fields[key];
          if (
            !field?.editable ||
            !action?.writableFields?.includes(key) ||
            action.parameters?.[key]?.type !== field.type
          )
            messages.push(
              `节点「${node.name}」字段「${key}」不在表单业务操作的同名同类型可写范围。`,
            );
        }
      }
      if (
        node.multiApprovalMode &&
        node.multiApprovalMode !== 'NONE' &&
        ((node.candidateUsers?.length ?? 0) < 2 || node.candidateGroups?.length)
      )
        messages.push(
          `节点「${node.name}」多人审批必须至少两名明确用户且不能混用候选组。`,
        );
      if (node.actions?.includes('return') && !node.returnTargets?.length)
        messages.push(`节点「${node.name}」需要配置允许退回的前置节点。`);
      if (
        node.requiredFields?.some((key) => !node.editableFields?.includes(key))
      )
        messages.push(`节点「${node.name}」必填字段必须属于可编辑字段。`);
      if (
        node.editableFields?.some((key) => !node.readableFields?.includes(key))
      )
        messages.push(`节点「${node.name}」可编辑字段必须同时可读。`);
    }
    if (node.type === 'parallelGateway' && outgoing.length > 1 && !node.joinId)
      messages.push(`并行分叉「${node.name}」需要选择对应汇聚网关。`);
    if (
      node.type === 'end' &&
      !['Approved', 'Rejected', 'Terminated', 'Withdrawn'].includes(
        node.outcome ?? '',
      )
    )
      messages.push(`结束节点「${node.name}」需要明确最终结果。`);
  }

  // 递归检查结构规则及变量引用，空组合不作为“默认通过”隐藏配置遗漏。
  function checkRule(rule?: WorkflowCondition, depth = 0) {
    if (!rule) return;
    if (depth > 8) {
      messages.push('条件树超过允许嵌套深度。');
      return;
    }
    const operation = Object.keys(rule)[0];
    if (!operation || Object.keys(rule).length !== 1) {
      messages.push('条件节点必须包含一个运算符。');
      return;
    }
    if (rule.all || rule.any) {
      const children = rule.all ?? rule.any ?? [];
      if (children.length === 0) messages.push('条件组合不能为空。');
      children.forEach((child) => checkRule(child, depth + 1));
      return;
    }
    if (rule.not) return checkRule(rule.not, depth + 1);
    if (rule.dependency) {
      if (!rule.dependency.purposeKey) messages.push('前置用途标识不能为空。');
      if (rule.dependency.purposeKey === definition.purposeKey)
        messages.push('业务用途不能依赖自身。');
      return;
    }
    if (rule.validator) {
      if (!business?.validators?.[rule.validator.key])
        messages.push('条件引用了不可用的业务校验器。');
      return;
    }
    const body = (rule as Record<string, unknown>)[operation];
    const operands = Array.isArray(body) ? body : [body];
    operands.forEach((operand) => {
      if (
        operand &&
        typeof operand === 'object' &&
        'variable' in operand &&
        !definition.variables?.[String(operand.variable)]
      )
        messages.push(`条件引用未知变量「${operand.variable}」。`);
    });
  }
  checkRule(definition.startPolicy?.condition);
  checkRule(definition.dependencies);
  definition.edges?.forEach((edge) => checkRule(edge.condition));
  if (
    definition.startPolicy?.mode === 'event' &&
    (!definition.startPolicy.events?.length ||
      !definition.startPolicy.servicePrincipal)
  )
    messages.push('自动启动必须选择事件和受限执行主体。');
  return messages;
}
