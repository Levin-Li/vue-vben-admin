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
