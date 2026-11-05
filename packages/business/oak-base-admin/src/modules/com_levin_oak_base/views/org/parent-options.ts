/** 授权组织树中禁止将组织设为自身或其后代的子级。 */
export function disableParentSubtree(
  nodes: Record<string, any>[],
  currentId?: string,
): Record<string, any>[] {
  const idOf = (node: Record<string, any>) =>
    String(node.id ?? node.key ?? node.value ?? '');
  const contains = (items: Record<string, any>[]): boolean =>
    items.some(
      (item) => idOf(item) === currentId || contains(item.children || []),
    );
  // 当前节点缺失时无法判断哪些节点是后代，关闭候选直到取得完整授权路径。
  const missingCurrent = Boolean(currentId && !contains(nodes));
  const mark = (
    items: Record<string, any>[],
    ancestorBlocked = false,
  ): Record<string, any>[] =>
    items.map((node) => {
      const blocked =
        ancestorBlocked || Boolean(currentId && idOf(node) === currentId);
      return {
        ...node,
        disabled: missingCurrent || blocked || Boolean(node.disabled),
        children: mark(node.children || [], blocked),
      };
    });
  return mark(nodes);
}
