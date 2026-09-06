/**
 * CRUD 生命周期验收清单。
 *
 * 每个普通 CRUD 页面在接入真实验收前都必须登记一项，并提供 create、update、delete
 * 三个适配器。这里的例外只排除扩展操作的表单，不能排除页面自身的新增、编辑、删除。
 */

export type CrudAcceptanceOperation = 'create' | 'delete' | 'update';

export interface CrudAcceptanceException {
  /** 不纳入本轮通用表单改造的扩展操作。 */
  excludedOperationLabels: string[];
  reason: string;
}

export interface CrudAcceptancePagePlan {
  /** 后端资源名，同时也是清单中的稳定唯一键。 */
  resource: string;
  route: string;
  title: string;
  /**
   * 普通 CRUD 的三步生命周期始终必须覆盖；只有扩展操作表单能列为例外。
   */
  requiredOperations: readonly CrudAcceptanceOperation[];
  specialOperationException?: CrudAcceptanceException;
}

export const REQUIRED_CRUD_ACCEPTANCE_OPERATIONS = [
  'create',
  'update',
  'delete',
] as const satisfies readonly CrudAcceptanceOperation[];

/**
 * 用户明确要求暂不改造这些页面的扩展操作表单。后续页级验收仍应覆盖其标准 C/U/D。
 * 租户设置类的最终资源范围由页级改造任务在接入前补全，不能以此清单推断业务行为。
 */
export const CRUD_SPECIAL_OPERATION_FORM_EXCEPTIONS: readonly CrudAcceptancePagePlan[] =
  [
    {
      requiredOperations: REQUIRED_CRUD_ACCEPTANCE_OPERATIONS,
      resource: 'Role',
      route: '/clob/V1/Role',
      specialOperationException: {
        excludedOperationLabels: ['资源权限', '组织数据权限'],
        reason: '属于角色授权扩展操作，不纳入普通新增、编辑、删除表单改造。',
      },
      title: '角色管理',
    },
    {
      requiredOperations: REQUIRED_CRUD_ACCEPTANCE_OPERATIONS,
      resource: 'Menu',
      route: '/clob/V1/Menu',
      specialOperationException: {
        excludedOperationLabels: ['新增下级', '批量删除', '菜单专属配置'],
        reason: '属于菜单树扩展操作，不纳入普通新增、编辑、删除表单改造。',
      },
      title: '菜单管理',
    },
    {
      requiredOperations: REQUIRED_CRUD_ACCEPTANCE_OPERATIONS,
      resource: 'Org',
      route: '/clob/V1/Org',
      specialOperationException: {
        excludedOperationLabels: ['组织树专属操作'],
        reason: '属于组织树扩展操作，不纳入普通新增、编辑、删除表单改造。',
      },
      title: '组织管理',
    },
    {
      requiredOperations: REQUIRED_CRUD_ACCEPTANCE_OPERATIONS,
      resource: 'User',
      route: '/clob/V1/User',
      specialOperationException: {
        excludedOperationLabels: ['用户授权及其它扩展操作'],
        reason: '属于用户扩展操作，不纳入普通新增、编辑、删除表单改造。',
      },
      title: '用户管理',
    },
  ];

export function validateCrudAcceptancePlan(
  plans: readonly CrudAcceptancePagePlan[],
): void {
  const seenResources = new Set<string>();

  for (const plan of plans) {
    if (!plan.resource || !plan.route || !plan.title) {
      throw new Error('CRUD 验收清单必须提供资源名、路由和页面标题');
    }

    if (seenResources.has(plan.resource)) {
      throw new Error(`CRUD 验收清单存在重复资源：${plan.resource}`);
    }

    seenResources.add(plan.resource);

    for (const operation of REQUIRED_CRUD_ACCEPTANCE_OPERATIONS) {
      if (!plan.requiredOperations.includes(operation)) {
        throw new Error(
          `${plan.resource} 缺少必须的 CRUD 验收操作：${operation}`,
        );
      }
    }
  }
}

validateCrudAcceptancePlan(CRUD_SPECIAL_OPERATION_FORM_EXCEPTIONS);
