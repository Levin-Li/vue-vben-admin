export interface AgentSkillCall {
  arguments: Record<string, unknown>;
  skill: string;
}

export interface AgentSkillResult {
  count: number;
  data: unknown;
  source: string;
}

export interface PendingAgentWrite {
  description: string;
  execute: () => Promise<string>;
  recheck: () => Promise<boolean>;
  source: string;
}

export interface AgentSkill {
  available?: () => boolean;
  description: string;
  execute?: (
    args: Record<string, unknown>,
    superAdmin: boolean,
  ) => Promise<AgentSkillResult>;
  id: string;
  inputSchema: {
    properties: Record<
      string,
      {
        enum?: readonly (boolean | number | string)[];
        maximum?: number;
        maxLength?: number;
        minimum?: number;
        minLength?: number;
        type: 'boolean' | 'integer' | 'string';
      }
    >;
    required: string[];
  };
  maxRecords: number;
  permission: string;
  preview?: (args: Record<string, unknown>) => Promise<PendingAgentWrite>;
  risk: 'confirm' | 'read';
  writeIntent?: readonly string[];
}

const moduleSkills = new Map<string, readonly AgentSkill[]>();

// 业务模块逐项注册真实接口处理器；菜单、页面动作和模型输出均不是技能注册源。
export function registerAdminAgentSkills(
  moduleId: string,
  skills: readonly AgentSkill[],
) {
  if (
    !moduleId ||
    new Set(skills.map((skill) => skill.id)).size !== skills.length ||
    skills.some(
      (skill) =>
        !skill.id.startsWith(`${moduleId}.`) ||
        !skill.inputSchema ||
        !Array.isArray(skill.inputSchema.required) ||
        !skill.inputSchema.properties,
    )
  ) {
    throw new Error('Agent 技能 ID 不得重复，必须带所属模块前缀与输入 Schema');
  }
  moduleSkills.set(moduleId, [...skills]);
}

export function listAdminAgentSkills(superAdmin: boolean): AgentSkill[] {
  return [...moduleSkills.values()].flat().filter((skill) => {
    if (!superAdmin && skill.permission === 'superAdmin') return false;
    try {
      return skill.available?.() !== false;
    } catch {
      return false;
    }
  });
}

export function agentObject(value: unknown): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('技能参数必须是对象');
  }
  return value as Record<string, unknown>;
}

export function agentExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error('技能参数包含未登记字段');
  }
}

export function agentId(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^[\w.-]{1,128}$/.test(value)) {
    throw new Error(`${name} 格式不正确`);
  }
  return value;
}

export function agentLimit(value: unknown, maximum: number): number {
  const limit = value === undefined ? Math.min(20, maximum) : value;
  if (
    !Number.isInteger(limit) ||
    Number(limit) < 1 ||
    Number(limit) > maximum
  ) {
    throw new Error(`查询条数必须在 1 到 ${maximum} 之间`);
  }
  return Number(limit);
}

// 只识别显式登记的单次技能调用；拒绝模型拼接任意路径或请求字段。
export function parseAgentSkillCall(text: string): AgentSkillCall | null {
  const normalized = text.trim().replaceAll(/^```(?:json)?\s*|\s*```$/g, '');
  let candidate: unknown;
  try {
    candidate = JSON.parse(normalized);
  } catch {
    return null;
  }
  if (!candidate || Array.isArray(candidate) || typeof candidate !== 'object')
    return null;
  const record = candidate as Record<string, unknown>;
  if (record.type !== 'skill_call') return null;
  agentExactKeys(record, ['type', 'skill', 'arguments']);
  const id = record.skill;
  if (
    typeof id !== 'string' ||
    ![...moduleSkills.values()].flat().some((skill) => skill.id === id)
  ) {
    throw new Error('模型建议的技能未获准执行');
  }
  return { arguments: agentObject(record.arguments), skill: id };
}

function requireSkill(call: AgentSkillCall, superAdmin: boolean): AgentSkill {
  const skill = listAdminAgentSkills(superAdmin).find(
    (entry) => entry.id === call.skill,
  );
  if (!skill) throw new Error('当前用户不可调用此技能');
  return skill;
}

// 在任何接口处理器之前统一校验，缺省字段不强行补值，具体业务仍执行自己的语义校验。
export function validateAgentSkillArguments(skill: AgentSkill, value: unknown) {
  const args = agentObject(value);
  agentExactKeys(args, Object.keys(skill.inputSchema.properties));
  for (const key of skill.inputSchema.required) {
    if (args[key] === undefined || args[key] === null) {
      throw new Error(`技能参数 ${key} 为必填项`);
    }
  }
  for (const [key, value] of Object.entries(args)) {
    const schema = skill.inputSchema.properties[key];
    if (!schema) throw new Error('技能参数包含未登记字段');
    const validType =
      schema.type === 'integer'
        ? Number.isSafeInteger(value)
        : (schema.type === 'string' && typeof value === 'string') ||
          (schema.type === 'boolean' && typeof value === 'boolean');
    if (!validType) throw new Error(`技能参数 ${key} 类型不正确`);
    if (
      typeof value === 'string' &&
      (value.length > (schema.maxLength ?? 4000) ||
        value.length < (schema.minLength ?? 0))
    )
      throw new Error(`技能参数 ${key} 长度超限`);
    if (
      typeof value === 'number' &&
      (value < (schema.minimum ?? -Number.MAX_SAFE_INTEGER) ||
        value > (schema.maximum ?? Number.MAX_SAFE_INTEGER))
    )
      throw new Error(`技能参数 ${key} 范围超限`);
    if (
      schema.enum &&
      !schema.enum.includes(value as boolean | number | string)
    ) {
      throw new Error(`技能参数 ${key} 不在允许范围`);
    }
  }
  return args;
}

export async function executeAgentSkill(
  call: AgentSkillCall,
  superAdmin: boolean,
) {
  const skill = requireSkill(call, superAdmin);
  if (skill.risk !== 'read' || !skill.execute)
    throw new Error('此技能不允许直接执行');
  return skill.execute(
    validateAgentSkillArguments(skill, call.arguments),
    superAdmin,
  );
}

export async function previewAgentWrite(
  call: AgentSkillCall,
  superAdmin: boolean,
) {
  const skill = requireSkill(call, superAdmin);
  if (skill.risk !== 'confirm' || !skill.preview)
    throw new Error('不是已登记的写入技能');
  const args = { ...validateAgentSkillArguments(skill, call.arguments) };
  const pending = await skill.preview(args);
  let consumed = false;

  // 预览不是授权凭据；确认与只读复查都重新检查当前权限，提交一经尝试就不可重放。
  return {
    ...pending,
    execute: async () => {
      if (consumed) throw new Error('本次写入已尝试提交，禁止重复执行');
      requireSkill(call, superAdmin);
      validateAgentSkillArguments(skill, args);
      consumed = true;
      return pending.execute();
    },
    recheck: async () => {
      requireSkill(call, superAdmin);
      return pending.recheck();
    },
  };
}

export async function confirmAgentWrite(
  pending: PendingAgentWrite,
): Promise<string> {
  return pending.execute();
}
