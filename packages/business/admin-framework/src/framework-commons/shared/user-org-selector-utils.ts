import type {
  UserOrgSelectorKind,
  UserOrgSelectorMode,
  UserOrgSelectorRecord,
  UserOrgTreeSelectNode,
} from './user-org-selector-types';

const SELECTED_GROUP_KEY = '__selected_user_org_records__';

export function normalizeSelectorTypes(value?: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  const normalized = String(value || '').trim();
  return normalized ? [normalized] : [];
}

export function encodeUserOrgSelectorKey(
  kind: UserOrgSelectorKind,
  id: string,
) {
  return `${kind}:${encodeURIComponent(id)}`;
}

export function decodeUserOrgSelectorKey(value?: unknown):
  | {
      id: string;
      kind: UserOrgSelectorKind;
    }
  | undefined {
  const text = String(value || '');
  const separatorIndex = text.indexOf(':');

  if (separatorIndex <= 0) {
    return undefined;
  }

  const kind = text.slice(0, separatorIndex);

  if (kind !== 'org' && kind !== 'user') {
    return undefined;
  }

  return {
    id: decodeURIComponent(text.slice(separatorIndex + 1)),
    kind,
  };
}

function getRawChildren(item: Record<string, any>) {
  const children =
    item.children || item.childList || item.subList || item.orgList || [];
  return Array.isArray(children) ? children.filter(Boolean) : [];
}

function isTypeMatched(type: unknown, acceptedTypes: string[]) {
  if (acceptedTypes.length === 0) {
    return true;
  }

  return acceptedTypes.includes(String(type || ''));
}

function canSelectKind(mode: UserOrgSelectorMode, kind: UserOrgSelectorKind) {
  return mode === 'both' || mode === kind;
}

export function normalizeOrgSelectorRecord(
  item: Record<string, any>,
): UserOrgSelectorRecord {
  const id = String(item.id ?? item.value ?? item.code ?? '');
  const name = String(item.name ?? item.label ?? item.title ?? id);

  return {
    id,
    kind: 'org',
    name,
    raw: item,
    type: item.type,
  };
}

export function normalizeUserSelectorRecord(
  item: Record<string, any>,
  org?: UserOrgSelectorRecord,
): UserOrgSelectorRecord {
  const id = String(item.id ?? item.value ?? item.code ?? '');
  const name = String(
    item.name ??
      item.nickname ??
      item.loginName ??
      item.label ??
      item.title ??
      id,
  );

  return {
    id,
    kind: 'user',
    name,
    orgId: String(item.orgId ?? org?.id ?? ''),
    orgName: String(item.orgName ?? org?.name ?? ''),
    raw: item,
    type: item.type,
  };
}

export function toUserOrgTreeSelectNode(
  record: UserOrgSelectorRecord,
  extra: Partial<UserOrgTreeSelectNode> = {},
): UserOrgTreeSelectNode {
  const key = encodeUserOrgSelectorKey(record.kind, record.id);

  return {
    ...record,
    key,
    label: record.name || record.id,
    title: record.name || record.id,
    value: key,
    ...extra,
  };
}

export function buildUserOrgSelectorOrgTree(
  items: Record<string, any>[],
  options: {
    mode: UserOrgSelectorMode;
    orgTypes: string[];
  },
): UserOrgTreeSelectNode[] {
  return items.reduce<UserOrgTreeSelectNode[]>((result, item) => {
    const record = normalizeOrgSelectorRecord(item);

    if (!record.id) {
      return result;
    }

    const children = buildUserOrgSelectorOrgTree(getRawChildren(item), options);
    const orgTypeMatched = isTypeMatched(record.type, options.orgTypes);

    if (!orgTypeMatched && children.length === 0) {
      return result;
    }

    const orgSelectable = canSelectKind(options.mode, 'org') && orgTypeMatched;
    const canLoadUsers = canSelectKind(options.mode, 'user') && orgTypeMatched;

    result.push(
      toUserOrgTreeSelectNode(record, {
        canLoadUsers,
        children,
        disabled: !orgSelectable,
        isLeaf: options.mode === 'org' ? children.length === 0 : false,
        selectable: orgSelectable,
      }),
    );

    return result;
  }, []);
}

export function flattenUserOrgTreeNodes(nodes: UserOrgTreeSelectNode[]) {
  const result: UserOrgTreeSelectNode[] = [];

  for (const node of nodes) {
    if (node.key !== SELECTED_GROUP_KEY) {
      result.push(node);
    }

    if (node.children?.length) {
      result.push(...flattenUserOrgTreeNodes(node.children));
    }
  }

  return result;
}

export function buildSelectedRecordGroupNode(
  records: UserOrgSelectorRecord[],
  existingKeys: Set<string>,
): UserOrgTreeSelectNode | undefined {
  const children = records
    .map((record) => toUserOrgTreeSelectNode(record))
    .filter((node) => !existingKeys.has(node.key));

  if (children.length === 0) {
    return undefined;
  }

  return {
    id: SELECTED_GROUP_KEY,
    kind: 'org',
    key: SELECTED_GROUP_KEY,
    label: '当前选择',
    name: '当前选择',
    title: '当前选择',
    value: SELECTED_GROUP_KEY,
    selectable: false,
    disabled: true,
    children,
  };
}

export function getSelectedGroupKey() {
  return SELECTED_GROUP_KEY;
}
