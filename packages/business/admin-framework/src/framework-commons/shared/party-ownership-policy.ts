import type { DataAttrField, DataAttrPolicy } from '../data-attr-policy';
import { validatePolicy } from '../data-attr-policy';
import type { PartyOwnershipAccess } from './party-ownership-types';

/** 归属字段必须在当前操作的实际模型中声明了字段组；未知路径不视为允许。 */
export function ownershipFieldAllowed(policy: DataAttrPolicy | undefined, direction: 'input' | 'output', field: string): boolean {
  if (!policy || !field) return false;
  try {
    validatePolicy(policy);
    const roots = direction === 'input' ? policy.viewRoots.request : policy.viewRoots.response;
    if (!roots.length) return false;
    const matches: DataAttrField[] = [];
    const visited = new Set<string>();
    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = policy.nodes[id];
      if (!node) throw new Error('字段策略节点缺失');
      if (node.kind === 'array' && node.elementNodeId) visit(node.elementNodeId);
      else if (node.kind === 'map' && node.valueNodeId) visit(node.valueNodeId);
      else if (node.kind === 'object') {
        for (const candidate of node.fields || []) {
          if ([candidate.name, candidate.wireName, ...(candidate.aliases || [])].includes(field)) matches.push(candidate);
        }
      }
    };
    roots.forEach(visit);
    return matches.length > 0 && matches.every((item) =>
      Boolean(item.groupIds?.length) && item.groupIds!.every((id) => policy.groups.some((group) => group.id === id && group.allowed)));
  } catch { return false; }
}

export function ownershipAccess(
  read: DataAttrPolicy | undefined,
  bind: DataAttrPolicy | undefined,
  adjust: DataAttrPolicy | undefined,
  allowed: { bind: boolean; adjust: boolean },
): PartyOwnershipAccess {
  return {
    canRead: (field) => ownershipFieldAllowed(read, 'output', field),
    canWrite: (operation, field) => allowed[operation] && ownershipFieldAllowed(operation === 'bind' ? bind : adjust, 'input', field),
    canOperate: (operation) => allowed[operation],
  };
}
