export interface ResourcePermissionLoadedTarget {
  code?: string;
  id: string;
  name: string;
  optimisticLock?: number;
  permissions: string[];
}

export interface ResourcePermissionChanges {
  id: string;
  optimisticLock?: number;
  permissions: string[];
}

export type ResourcePermissionLoadTarget =
  () => Promise<ResourcePermissionLoadedTarget>;
export type ResourcePermissionSaveTarget = (
  changes: ResourcePermissionChanges,
) => Promise<unknown>;
