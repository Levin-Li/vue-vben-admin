/** 只把明确的零影响结果识别为失败，兼容返回空值或业务对象的接口。 */
export function assertCrudMutationApplied(
  result: unknown,
  action: '删除' | '更新',
) {
  const noEffect =
    result === false ||
    result === 0 ||
    (result !== null &&
      typeof result === 'object' &&
      !Array.isArray(result) &&
      Object.hasOwn(result, 'affected') &&
      (result as { affected?: unknown }).affected === 0);
  if (noEffect)
    throw new Error(
      `${action}未生效，记录可能已变化或不在当前可操作范围，请刷新后重试`,
    );
}
