import type { CrudFieldConfig } from './types';

export interface CrudWizardStep {
  fields: CrudFieldConfig[];
  key: string;
  title: string;
}

/** 接收权限、显隐与不提交组过滤后的字段，按展示顺序建立实际步骤。 */
export function buildCrudWizardSteps(
  fields: CrudFieldConfig[],
): CrudWizardStep[] {
  const steps: CrudWizardStep[] = [];
  const grouped = new Map<string, CrudWizardStep>();
  let ungrouped: CrudWizardStep | undefined;
  let ungroupedIndex = 0;
  for (const field of fields) {
    // 静态布局键不代表运行时一定显示分组，步骤只使用最终展示组。
    const group = field.displayGroup?.key?.trim();
    if (!group) {
      if (!ungrouped) {
        ungrouped = {
          key: `ungrouped:${ungroupedIndex++}`,
          title: '其他信息',
          fields: [],
        };
        steps.push(ungrouped);
      }
      ungrouped.fields.push(field);
      continue;
    }
    ungrouped = undefined;
    let step = grouped.get(group);
    if (!step) {
      step = {
        key: `group:${group}`,
        title: field.displayGroup?.title || field.layoutGroupTitle || group,
        fields: [],
      };
      grouped.set(group, step);
      steps.push(step);
    }
    step.fields.push(field);
  }
  return steps;
}

/** 找不到字段时返回 -1，调用方保留当前步骤。 */
export function findCrudWizardStep(
  steps: CrudWizardStep[],
  fieldKey: string,
): number {
  return steps.findIndex((step) =>
    step.fields.some((field) => field.key === fieldKey),
  );
}
