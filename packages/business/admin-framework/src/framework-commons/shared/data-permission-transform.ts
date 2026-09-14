import type {
  PermissionTreeNode,
  RbacModuleNode,
} from './data-permission-types';

import { RbacPermissionMatchUtils } from '../rbac-permission-match';

export function mergeUnmappedPermissions(
  selected: string[],
  unmapped: string[],
) {
  return [...new Set([...selected, ...unmapped].filter(Boolean))];
}

export function removePermissionValue(
  permissions: string[],
  permissionToRemove: string,
) {
  return permissions.filter((item) => item !== permissionToRemove);
}

export function collectPermissionValues(checkedPermissions: string[]) {
  return [...new Set(checkedPermissions.filter(Boolean))];
}

export function collectKnownPermissionValues(modules: RbacModuleNode[]) {
  const values = new Set<string>();
  for (const moduleItem of modules) {
    for (const typeItem of moduleItem.typeList || []) {
      for (const resourceItem of typeItem.resList || []) {
        for (const actionItem of resourceItem.actionList || []) {
          if (actionItem.permissionExpr) values.add(actionItem.permissionExpr);
        }
      }
    }
  }
  return values;
}

export function collectKnownPermissionTreeValues(nodes: PermissionTreeNode[]) {
  const values = new Set<string>();
  for (const node of nodes) {
    if (node.permissionExpr) values.add(node.permissionExpr);
    for (const childValue of collectKnownPermissionTreeValues([
      ...(node.children || []),
      ...(node.resourcePermissions || []),
    ]))
      values.add(childValue);
  }
  return values;
}

export function splitMappedAndUnmappedPermissions(
  value: string[],
  modules: RbacModuleNode[],
  permissionTree: PermissionTreeNode[] = [],
) {
  const treeValues = collectKnownPermissionTreeValues(permissionTree);
  const knownValues =
    treeValues.size > 0 ? treeValues : collectKnownPermissionValues(modules);
  const mapped = [...knownValues].filter((permissionExpr) =>
    RbacPermissionMatchUtils.simpleMatchList(permissionExpr, value),
  );
  const unmapped = value.filter(
    (permission) =>
      ![...knownValues].some((permissionExpr) =>
        RbacPermissionMatchUtils.simpleMatchList(permissionExpr, [permission]),
      ),
  );
  return { mapped, unmapped };
}
