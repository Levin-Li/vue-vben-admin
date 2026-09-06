/** UI 禁用和接口可写性由调用方分别判定；阻止输入事件不能改变提交资格。 */
export function updateCrudFieldInput(
  state: Record<string, any>,
  key: string,
  value: any,
  disabled: boolean,
) {
  if (disabled) return false;
  state[key] = value;
  return true;
}
