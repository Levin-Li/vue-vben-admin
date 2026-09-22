export function buildCrudConfirmConfig(
  confirmText?: string,
  confirmTitle?: string,
) {
  const text = String(confirmText || '').trim();

  if (!text || text === 'None') {
    return {
      enabled: false as const,
    };
  }

  return {
    enabled: true as const,
    text,
    title: confirmTitle || '操作确认',
  };
}

export function buildNoFormFlowConfirmConfig(input: {
  confirmText?: string;
  confirmTitle?: string;
  eventName: string;
  flowFormFields?: null | string[];
  recordTitle: string;
}) {
  // 显式确认文案及 None 例外优先于流程兜底，避免覆盖控制器声明的交互。
  const configured = buildCrudConfirmConfig(
    input.confirmText,
    input.confirmTitle,
  );
  if (configured.enabled || String(input.confirmText || '').trim() === 'None') {
    return configured;
  }

  // 只有显式空列表才表示无表单；未声明、null 和非空列表均不能被误判。
  if (!Array.isArray(input.flowFormFields) || input.flowFormFields.length > 0) {
    return configured;
  }

  return {
    enabled: true as const,
    text: `确认「${input.eventName}」吗？`,
    title: `确认${input.eventName}`,
  };
}
