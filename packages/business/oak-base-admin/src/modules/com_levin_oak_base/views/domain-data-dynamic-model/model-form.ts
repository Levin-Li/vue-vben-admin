import type {
  DataModelDefinition,
  DataModelScopeKind,
  SaveDataModelInput,
} from '../../api/data-model-service';

export const scopeOptions: Array<{ label: string; value: DataModelScopeKind }> =
  [
    { label: '平台模型（所有租户可见定义）', value: 'PLATFORM' },
    { label: '租户模型（本租户可见定义）', value: 'TENANT' },
    { label: '组织模型（本组织可见定义）', value: 'ORG' },
    { label: '私人模型（默认当前用户）', value: 'PRIVATE' },
  ];

export function scopeKindOf(model: DataModelDefinition): DataModelScopeKind {
  if (model.scopeKind) return model.scopeKind;
  if (model.ownerId) return 'PRIVATE';
  if (model.orgId) return 'ORG';
  if (model.tenantId) return 'TENANT';
  return 'PLATFORM';
}

export type DataModelBaseDraft = Omit<SaveDataModelInput, 'scopeKind'> & {
  scopeKind?: DataModelScopeKind;
};

export function baseDraftOf(model?: DataModelDefinition): DataModelBaseDraft {
  return model
    ? {
        key: model.key,
        name: model.name,
        title: model.title,
        description: model.description,
        scopeKind: scopeKindOf(model),
        tenantShared: model.tenantShared === true,
        orgShared: model.orgShared === true,
        ownerId: model.ownerId,
        version: model.version,
      }
    : {
        key: '',
        name: '',
        title: '',
        scopeKind: undefined,
        tenantShared: false,
        orgShared: false,
      };
}

// 归属 ID 仅由后端根据可信身份及范围决定，页面只提交范围意图。
export function toBaseSaveInput(
  draft: DataModelBaseDraft,
  canChooseOwner: boolean,
): SaveDataModelInput {
  // 新建时必须由页面选定实际可用的归属，不从角色猜测私人或平台范围。
  if (!draft.scopeKind) throw new Error('请选择归属范围');

  return {
    key: draft.key.trim(),
    name: draft.name.trim(),
    title: draft.title.trim(),
    description: draft.description?.trim(),
    scopeKind: draft.scopeKind,
    version: draft.version,
    ...(draft.scopeKind === 'PLATFORM'
      ? {}
      : { tenantShared: draft.tenantShared === true }),
    ...(['ORG', 'PRIVATE'].includes(draft.scopeKind)
      ? { orgShared: draft.orgShared === true }
      : {}),
    ...(draft.scopeKind === 'PRIVATE' && canChooseOwner && draft.ownerId
      ? { ownerId: draft.ownerId }
      : {}),
  };
}
