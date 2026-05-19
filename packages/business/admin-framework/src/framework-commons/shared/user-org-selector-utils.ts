import type {
  UserOrgSelectorKind,
  UserOrgSelectorMode,
  UserOrgSelectorOrgLoadMode,
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

function getRawOrgType(item: Record<string, any>) {
  return item.type ?? item.orgType ?? item.typeCode ?? item.category;
}

function getRawHasChildren(item: Record<string, any>, childrenLength: number) {
  if (childrenLength > 0) {
    return true;
  }

  if (typeof item.isLeaf === 'boolean') {
    return !item.isLeaf;
  }

  if (typeof item.hasChildren === 'boolean') {
    return item.hasChildren;
  }

  if (typeof item.childrenCount === 'number') {
    return item.childrenCount > 0;
  }

  return false;
}

export function isUserOrgSelectorTypeMatched(
  type: unknown,
  acceptedTypes: string[],
) {
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
    type: getRawOrgType(item),
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
    type: item.type ?? item.userType ?? item.typeCode,
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
    allowSelectOrg?: boolean;
    allowSelectUser?: boolean;
    depth?: number;
    maxLoadDeep?: number;
    mode?: UserOrgSelectorMode;
    onlyLeafNode?: boolean;
    onlyNotLeafNode?: boolean;
    onlyShowTypeMatchNode?: boolean;
    orgLoadMode?: UserOrgSelectorOrgLoadMode;
    orgTypes: string[];
  },
): UserOrgTreeSelectNode[] {
  const depth = options.depth ?? 1;
  const maxLoadDeep = options.maxLoadDeep ?? 0;

  return items.reduce<UserOrgTreeSelectNode[]>((result, item) => {
    const record = normalizeOrgSelectorRecord(item);

    if (!record.id) {
      return result;
    }

    const rawChildren = getRawChildren(item);
    const canBuildChildren = maxLoadDeep <= 0 || depth < maxLoadDeep;
    const children = canBuildChildren
      ? buildUserOrgSelectorOrgTree(rawChildren, {
          ...options,
          depth: depth + 1,
        })
      : [];
    const orgTypeMatched = isUserOrgSelectorTypeMatched(
      record.type,
      options.orgTypes,
    );

    if (
      options.onlyShowTypeMatchNode &&
      !orgTypeMatched &&
      children.length > 0
    ) {
      result.push(...children);
      return result;
    }

    if (
      options.onlyShowTypeMatchNode &&
      !orgTypeMatched &&
      children.length === 0
    ) {
      return result;
    }

    const hasChildren = getRawHasChildren(item, rawChildren.length);
    const mode = options.mode ?? 'both';
    const allowSelectOrg = options.allowSelectOrg ?? canSelectKind(mode, 'org');
    const allowSelectUser =
      options.allowSelectUser ?? canSelectKind(mode, 'user');
    const canAttemptLazyLoad =
      options.orgLoadMode === 'lazy' &&
      (maxLoadDeep <= 0 || depth < maxLoadDeep);
    const isLeaf =
      options.orgLoadMode === 'lazy' && canAttemptLazyLoad
        ? false
        : !hasChildren;
    const matchLeafRule =
      (!options.onlyLeafNode || isLeaf) &&
      (!options.onlyNotLeafNode || !isLeaf);
    const orgSelectable = allowSelectOrg && orgTypeMatched && matchLeafRule;
    const canLoadUsers = allowSelectUser && orgTypeMatched;

    result.push(
      toUserOrgTreeSelectNode(record, {
        canLoadUsers,
        children,
        depth,
        disabled: !orgSelectable,
        hasChildren,
        isLeaf:
          options.orgLoadMode === 'lazy'
            ? !canAttemptLazyLoad && !canLoadUsers && children.length === 0
            : !canLoadUsers && children.length === 0,
        loadAttempted: false,
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

export function limitUserOrgSelectorRecords(
  records: UserOrgSelectorRecord[],
  maxSelectCount: number,
) {
  if (maxSelectCount === 1) {
    return {
      limited: records.length > 1,
      records: records.slice(-1),
    };
  }

  if (maxSelectCount > 1 && records.length > maxSelectCount) {
    return {
      limited: true,
      records: records.slice(0, maxSelectCount),
    };
  }

  return {
    limited: false,
    records,
  };
}

export function getSelectedGroupKey() {
  return SELECTED_GROUP_KEY;
}
