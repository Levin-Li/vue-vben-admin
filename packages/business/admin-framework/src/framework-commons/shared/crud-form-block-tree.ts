export interface CrudFormFlatBlock<TField> {
  complexGroupKey?: string;
  fields: TField[];
}

export interface CrudFormBlock<TField> extends CrudFormFlatBlock<TField> {
  children: CrudFormBlock<TField>[];
}

/** 按对象的 parentKey 组织可见区块，缺少可见父区块时保持当前区块可见。 */
export function nestCrudFormBlocks<TField>(
  blocks: CrudFormFlatBlock<TField>[],
  groups: { key: string; parentKey?: string }[],
): CrudFormBlock<TField>[] {
  const nodes = blocks.map((block) => ({
    ...block,
    children: [] as CrudFormBlock<TField>[],
  }));
  const byKey = new Map(
    nodes
      .filter((node) => node.complexGroupKey)
      .map((node) => [node.complexGroupKey, node]),
  );
  const parents = new Map(groups.map((group) => [group.key, group.parentKey]));
  const roots: CrudFormBlock<TField>[] = [];

  for (const node of nodes) {
    const key = node.complexGroupKey;
    const parentKey = key ? parents.get(key) : undefined;
    const parent = parentKey ? byKey.get(parentKey) : undefined;
    const ancestors = new Set<string>();
    let ancestor = parentKey;
    while (ancestor && ancestor !== key && !ancestors.has(ancestor)) {
      ancestors.add(ancestor);
      ancestor = parents.get(ancestor);
    }
    if (parent && key && !ancestor) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
