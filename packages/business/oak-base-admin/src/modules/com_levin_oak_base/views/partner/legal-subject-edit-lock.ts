// 编辑时仅以服务端加载的原始记录决定是否锁定，避免首次选择后立刻无法改选。
export function isLegalSubjectPickerLocked(
  disabled: boolean,
  editingRecord?: null | Record<string, unknown>,
): boolean {
  return disabled || Boolean(editingRecord?.legalSubjectId);
}
