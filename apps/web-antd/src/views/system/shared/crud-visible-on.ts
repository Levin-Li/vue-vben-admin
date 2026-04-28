export function evaluateCrudVisibleOn(
  visibleOn: string | undefined,
  record: Record<string, any>,
  userInfo: null | Record<string, any> | undefined,
) {
  const script = String(visibleOn || '').trim();

  if (!script) {
    return true;
  }

  try {
    return Boolean(
      // 后端 @CRUD.Op.visibleOn 明确定义为 js 脚本，这里集中解释而不是散落到各页面。
      // eslint-disable-next-line no-new-func
      new Function(
        '__user',
        '__record',
        `with (__record || {}) { return (${script}); }`,
      )(userInfo || {}, record || {}),
    );
  } catch (error) {
    console.warn('执行 CRUD.Op.visibleOn 失败', script, error);
    return false;
  }
}
