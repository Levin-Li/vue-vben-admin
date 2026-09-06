import type {
  CrudDisplayRule,
  CrudFieldConfig,
  CrudPageDisplayConfig,
  CrudPageDisplayFieldConfig,
  CrudPageDisplayGroupConfig,
  CrudPageDisplayHeaderConfig,
  CrudPageDisplayQueryCollapsedRows,
} from './types';

export type CrudDisplayState = 'ABSENT' | 'HIDDEN' | 'VISIBLE';

export const CRUD_OPERATION_COLUMN_KEY = '__actions';
export const CRUD_OPERATION_COLUMN_LABEL = '操作';
export const DEFAULT_CRUD_OPERATION_COLUMN_WIDTH = 220;

/** 仅为显式声明 DomainObject 的页面补入标准领域字段，避免向其它接口伪造参数。 */
export function resolveDomainObjectCrudFields(
  fields: CrudFieldConfig[],
  domainObject: boolean | undefined,
  domainIdField: CrudFieldConfig,
) {
  if (!domainObject || fields.some((field) => field.key === 'domainId')) {
    return fields;
  }
  return [...fields, domainIdField];
}

/** 将符合开发期分组门槛的静态布局组转换为详情可渲染的展示分组。 */
export function resolveStaticDisplayGroup(
  fields: CrudFieldConfig[],
  groupKey: string | undefined,
): CrudPageDisplayGroupConfig | undefined {
  if (!groupKey || fields.length < 7) return undefined;

  const groupFields = fields.filter(
    (field) =>
      field.layoutGroup === groupKey && Boolean(field.layoutGroupTitle?.trim()),
  );
  if (groupFields.length < 3) return undefined;

  return {
    defaultExpanded: true,
    displayStyle: 'divider',
    key: groupKey,
    order: Math.min(
      ...groupFields.map((field) => field.layoutOrder ?? Number.MAX_SAFE_INTEGER),
    ),
    title: groupFields.find((field) => field.layoutGroupTitle?.trim())
      ?.layoutGroupTitle,
  };
}

export function findDisplayRuleCycle(items: CrudPageDisplayFieldConfig[]) {
  const itemKeys = new Set(items.map((item) => item.key));
  const edges = new Map<string, string[]>();
  for (const item of items) {
    const rule = item.visibility;
    const targets = [
      ...(rule?.dependsOn?.fieldKeys || []),
      ...(rule?.exclusiveWith?.fieldKeys || []),
    ].filter((key) => itemKeys.has(key));
    edges.set(item.key, targets);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];
  const visit = (key: string): string[] | undefined => {
    const cycleStart = path.indexOf(key);
    if (cycleStart >= 0) return [...path.slice(cycleStart), key];
    if (visited.has(key)) return undefined;
    visiting.add(key);
    path.push(key);
    for (const target of edges.get(key) || []) {
      const cycle = visit(target);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(key);
    visited.add(key);
    return undefined;
  };
  for (const item of items) {
    const cycle = visit(item.key);
    if (cycle) return cycle;
  }
  return undefined;
}

export function hasDisplayRuleCycle(items: CrudPageDisplayFieldConfig[]) {
  return Boolean(findDisplayRuleCycle(items));
}

export function hasServerListHeaderConfig(
  config: CrudPageDisplayConfig | undefined,
) {
  return Boolean(config?.list?.headers?.length);
}

export function resolvePageDisplayViewTitle(
  field: Pick<CrudPageDisplayFieldConfig, 'label'> | undefined,
  fallbackTitle: string,
) {
  return field?.label?.trim() || fallbackTitle;
}

export function canUseLocalTableColumnSettings(
  config: CrudPageDisplayConfig | undefined,
  tableFieldCount: number,
  hasServerPageDisplaySetting = false,
) {
  return (
    !hasServerPageDisplaySetting &&
    tableFieldCount > 0 &&
    !hasServerListHeaderConfig(config)
  );
}

export function resolvePageDisplaySettingCode(
  routePath: string | undefined,
  fallbackCode: string | undefined,
) {
  return routePath?.trim() || fallbackCode?.trim() || 'crud-page';
}

export function resolvePageDisplayContextKey(
  userInfo: Record<string, any> | undefined,
  hostname: string | undefined,
) {
  const source = userInfo || {};
  return [
    source.tenantId || '',
    hostname || '',
    source.type || source.userType || '',
    source.category || source.userCategory || '',
    source.orgCategory || source.orgId || '',
    source.orgType || source.org?.type || '',
  ].join(':');
}

/** 恢复页面展示配置中的查询区默认折叠语义。 */
export function resolveQueryCollapsedRows(
  config: CrudPageDisplayConfig | undefined,
) {
  return config?.query?.unassignedExpandedRows ?? 1;
}

export function resolveQueryCollapsedFieldCount(
  fieldCount: number,
  columnCount: number,
  collapsedRows: CrudPageDisplayQueryCollapsedRows | undefined,
) {
  const totalFields = Math.max(Math.floor(fieldCount || 0), 0);
  if (collapsedRows === 'all') return totalFields;

  const rows = Math.min(Math.max(collapsedRows || 1, 1), 10);
  const columns = Math.max(Math.floor(columnCount || 0), 1);
  return Math.min(totalFields, Math.max(rows * columns - 1, 1));
}

export function shouldAutoQuery(
  autoSearchEnabled: boolean,
  ready: boolean,
  suppressed: boolean,
) {
  return autoSearchEnabled && ready && !suppressed;
}

/** 单个普通文本查询字段适合使用防抖自动查询。 */
export function shouldUseSingleTextQueryAutoSearch(
  fields: CrudFieldConfig[],
  autoSearchEnabled: boolean,
) {
  if (autoSearchEnabled || fields.length !== 1) {
    return false;
  }

  const [field] = fields;
  return (
    !field.multiple &&
    (field.type === undefined || field.type === 'text') &&
    field.valueType !== 'boolean' &&
    field.valueType !== 'number'
  );
}

export function shouldShowManualQueryButton(
  canQuery: boolean,
  autoSearchEnabled: boolean,
) {
  return canQuery && !autoSearchEnabled;
}

export function shouldAutoForceUpdateField(
  config: CrudPageDisplayConfig | undefined,
) {
  return config?.edit?.autoForceUpdateField !== false;
}

export function supportsInlineChoiceOptions(
  field: Pick<
    CrudFieldConfig,
    'type' | 'valueType' | 'options' | 'loadOptions'
  >,
) {
  return (
    field.type === 'switch' ||
    field.valueType === 'boolean' ||
    Array.isArray(field.options) ||
    field.loadOptions?.optionSource === 'dictionary' ||
    field.loadOptions?.optionSource === 'enum'
  );
}

/** 与 CRUD 列表实际渲染保持一致的默认列宽，用于配置面板回填。 */
export function resolveDefaultTableColumnWidth(
  field: Pick<
    CrudFieldConfig,
    'key' | 'label' | 'sortable' | 'type' | 'valueType' | 'width'
  >,
) {
  if (field.width) return field.width;
  if (field.type === 'datetime') return 180;
  if (field.type === 'date' || field.type === 'time') return 140;
  if (field.type === 'image') return 96;
  if (field.type === 'switch' || field.valueType === 'boolean') return 110;
  if (field.type === 'number' || field.valueType === 'number') return 110;

  const sorterWidth =
    field.sortable !== false && field.key !== '__tenant' ? 40 : 24;
  return Math.min(
    180,
    Math.max(96, field.label.length * 14 + sorterWidth, 120),
  );
}

/** 列宽不足时保持最小宽度；仅把多余空间按配置分配给各列。 */
export function distributeExtraTableWidth(
  minimumWidths: number[],
  availableWidth: number,
) {
  const widths = minimumWidths.map((width) => Math.max(Math.round(width), 1));
  const minimumTotal = widths.reduce((total, width) => total + width, 0);
  const extraWidth = Math.max(Math.floor(availableWidth) - minimumTotal, 0);
  if (!extraWidth || !widths.length) return widths;

  const totalWeight = widths.reduce((total, width) => total + width, 0);
  let distributed = 0;
  return widths.map((width, index) => {
    const extra =
      index === widths.length - 1
        ? extraWidth - distributed
        : Math.round((extraWidth * (widths[index] ?? width)) / totalWeight);
    distributed += extra;
    return width + extra;
  });
}

/** 组织信息可能来自登录用户的直连字段或嵌套组织对象，统一为脚本上下文。 */
export function buildOrganizationScriptContext(
  userInfo: Record<string, any> | undefined,
) {
  const source = userInfo || {};
  const nested = source.org || source.organization || source.dept;
  const org =
    nested && typeof nested === 'object' ? (nested as Record<string, any>) : {};
  return {
    code:
      org.code ?? source.orgCode ?? source.organizationCode ?? source.deptCode,
    enable:
      org.enable ??
      source.orgEnable ??
      source.organizationEnable ??
      source.deptEnable,
    id:
      org.id ??
      source.orgId ??
      source.organizationId ??
      source.deptId ??
      source.currentOrgId ??
      source.defaultOrgId,
    level:
      org.level ??
      source.orgLevel ??
      source.organizationLevel ??
      source.deptLevel,
    name:
      org.name ?? source.orgName ?? source.organizationName ?? source.deptName,
    parentId:
      org.parentId ??
      source.orgParentId ??
      source.organizationParentId ??
      source.deptParentId,
    path:
      org.path ?? source.orgPath ?? source.organizationPath ?? source.deptPath,
    type:
      org.type ?? source.orgType ?? source.organizationType ?? source.deptType,
  };
}

export function shouldStartQueryGroupOnNewLine(
  groupKey: string | undefined,
  previousGroupKey: string | undefined,
) {
  return Boolean(groupKey && groupKey !== previousGroupKey);
}

export function isRoleVisibilitySatisfied(
  visibleRoleCodes: string[] | undefined,
  userRoleCodes: Iterable<string>,
) {
  if (!visibleRoleCodes?.length) return true;
  const userRoles = new Set(userRoleCodes);
  return visibleRoleCodes.some((roleCode) => userRoles.has(roleCode));
}

/** 分组条件在字段条件之前生效；不展示分组时，其中字段没有展示或提交资格。 */
export function isDisplayGroupVisible(
  group: Pick<CrudPageDisplayGroupConfig, 'visibleRoleCodes'> | undefined,
  expressionResult: boolean,
  userRoleCodes: Iterable<string>,
) {
  return (
    expressionResult &&
    isRoleVisibilitySatisfied(group?.visibleRoleCodes, userRoleCodes)
  );
}

export function getDefaultVisibleRoleCodes(fieldKey: string) {
  if (fieldKey === 'tenantId') return ['R_SA'];
  if (fieldKey === 'orgId') {
    return ['R_ORG_ADMIN', 'R_SA', 'R_ADMIN', 'R_SAAS_ADMIN'];
  }
  return [];
}

export function initializeVisibleRoleCodes(
  field: Pick<CrudPageDisplayFieldConfig, 'key' | 'visibleRoleCodes'>,
) {
  return Object.hasOwn(field, 'visibleRoleCodes')
    ? field.visibleRoleCodes || []
    : getDefaultVisibleRoleCodes(field.key);
}

export function getDefaultFieldHidden(
  field: string | { key: string; showIdOnCreate?: boolean },
  options: { hideDomainId?: boolean } = { hideDomainId: false },
) {
  const key = typeof field === 'string' ? field : field.key;
  if (key === 'id' && typeof field !== 'string' && field.showIdOnCreate) {
    return false;
  }
  // DomainObject 的 domainId 是数据范围定位字段；新增、编辑、详情与列表默认隐藏，
  // 页面展示设置显式保存展示状态后仍可覆盖这个默认值。查询条件不应用此默认值。
  return (
    ['editable', 'id', 'lastUpdateTime', 'orderCode'].includes(key) ||
    (options.hideDomainId === true && key === 'domainId')
  );
}

export function initializeFieldHidden(
  field: Pick<CrudPageDisplayFieldConfig, 'hidden' | 'key'>,
) {
  return Object.hasOwn(field, 'hidden')
    ? field.hidden === true
    : getDefaultFieldHidden(field.key);
}

export function initializeHeaderVisibility(
  header: Pick<CrudPageDisplayHeaderConfig, 'key' | 'visible'>,
  options: { hideDomainId?: boolean } = { hideDomainId: false },
) {
  const defaultMode = getDefaultFieldHidden(header.key, options)
    ? 'hidden'
    : 'always';
  if (!Object.hasOwn(header, 'visible')) {
    return { mode: defaultMode as 'always' | 'hidden' | 'script' };
  }

  const visible = header.visible
    ? { ...header.visible }
    : { mode: defaultMode as 'always' | 'hidden' | 'script' };

  visible.mode ||= visible.expression?.trim() ? 'script' : defaultMode;

  return visible;
}

export function resolveRuntimeDisplayField(
  field: CrudPageDisplayFieldConfig,
): CrudPageDisplayFieldConfig {
  return {
    ...field,
    hidden: initializeFieldHidden(field),
    inputDisplay: field.inputDisplay || 'default',
    visibleRoleCodes: initializeVisibleRoleCodes(field),
  };
}

export function resolveRuntimeDisplayHeader(
  header: CrudPageDisplayHeaderConfig,
): CrudPageDisplayHeaderConfig {
  return {
    ...header,
    visible: initializeHeaderVisibility(header),
    visibleRoleCodes: initializeVisibleRoleCodes(header),
  };
}

function hasSameStringValues(
  left: string[] | undefined,
  right: string[] | undefined,
) {
  return (
    left === right ||
    (left?.length === right?.length &&
      left?.every((value, index) => value === right?.[index]))
  );
}

export function reconcileCrudPageDisplayHeaders(
  headers: CrudPageDisplayHeaderConfig[],
  fields: Array<
    Pick<
      CrudFieldConfig,
      'key' | 'label' | 'sortable' | 'table' | 'type' | 'valueType' | 'width'
    >
  >,
  options: { hideDomainId?: boolean; includeOperationColumn?: boolean } = {},
) {
  const existing = new Map(headers.map((header) => [header.key, header]));
  const listFields = fields
    .filter((field) => field.table)
    .concat(
      options.includeOperationColumn
        ? {
            key: CRUD_OPERATION_COLUMN_KEY,
            label: CRUD_OPERATION_COLUMN_LABEL,
            table: true,
            width: DEFAULT_CRUD_OPERATION_COLUMN_WIDTH,
          }
        : [],
    );

  const reconciled = listFields.map((field, index) => {
    const current = existing.get(field.key);
    const isOperationColumn = field.key === CRUD_OPERATION_COLUMN_KEY;
    const defaults: CrudPageDisplayHeaderConfig = current || {
      key: field.key,
      label: field.label,
      order: index,
      valueDisplay: { mode: 'default' },
      visible: initializeHeaderVisibility(
        { key: field.key },
        { hideDomainId: options.hideDomainId === true },
      ),
      visibleRoleCodes: getDefaultVisibleRoleCodes(field.key),
      width: resolveDefaultTableColumnWidth(field),
    };
    const label = defaults.label || field.label;
    const order = isOperationColumn ? index : defaults.order;
    const visible = initializeHeaderVisibility(defaults);
    const visibleRoleCodes = initializeVisibleRoleCodes(defaults);
    const width =
      defaults.width === 'auto' || !defaults.width
        ? resolveDefaultTableColumnWidth(field)
        : defaults.width;

    if (
      current &&
      current.label === label &&
      current.order === order &&
      current.width === width &&
      current.visible?.expression === visible.expression &&
      current.visible?.mode === visible.mode &&
      hasSameStringValues(current.visibleRoleCodes, visibleRoleCodes)
    ) {
      return current;
    }

    return {
      ...defaults,
      label,
      order,
      visible,
      visibleRoleCodes,
      width,
    };
  });
  return [
    ...reconciled,
    ...headers.filter((header) => header.virtual === true),
  ].toSorted(
    (left, right) =>
      (left.order ?? Number.MAX_SAFE_INTEGER) -
      (right.order ?? Number.MAX_SAFE_INTEGER),
  );
}

function getNestedRecord(
  record: Record<string, any> | undefined,
  keys: string[],
): Record<string, any> | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, any>;
    }
  }
  return undefined;
}

/**
 * 租户脚本上下文只暴露当前前端已持有的安全字段，不注入 appSecret、encryptKey 等敏感信息。
 */
export function buildTenantScriptContext(
  tenantSiteInfo: Record<string, any> | undefined,
  userInfo: Record<string, any> | undefined,
) {
  const tenantRecord = getNestedRecord(userInfo, [
    'tenant',
    'tenantInfo',
    'currentTenant',
  ]);
  const siteInfo =
    getNestedRecord(tenantSiteInfo, ['siteInfo']) ||
    getNestedRecord(tenantRecord, ['siteInfo']) ||
    getNestedRecord(getNestedRecord(userInfo, ['tenantSiteInfo']), [
      'siteInfo',
    ]);

  return {
    code: tenantRecord?.code ?? userInfo?.tenantCode,
    copyright:
      siteInfo?.copyright ??
      tenantSiteInfo?.copyright ??
      tenantRecord?.copyright,
    domain:
      tenantSiteInfo?.domain ?? tenantRecord?.domain ?? userInfo?.tenantDomain,
    id:
      tenantSiteInfo?.tenantId ??
      tenantRecord?.id ??
      tenantRecord?.tenantId ??
      userInfo?.tenantId,
    logo: siteInfo?.logo ?? tenantSiteInfo?.logo ?? tenantRecord?.logo,
    mainImg:
      siteInfo?.mainImg ?? tenantSiteInfo?.mainImg ?? tenantRecord?.mainImg,
    name: tenantSiteInfo?.name ?? tenantRecord?.name ?? userInfo?.tenantName,
    shortcutIcon:
      siteInfo?.shortcutIcon ??
      tenantSiteInfo?.shortcutIcon ??
      tenantRecord?.shortcutIcon,
    siteInfo: siteInfo
      ? {
          copyright: siteInfo.copyright,
          logo: siteInfo.logo,
          mainImg: siteInfo.mainImg,
          shortcutIcon: siteInfo.shortcutIcon,
          techSupport: siteInfo.techSupport,
          title: siteInfo.title,
          titleImg: siteInfo.titleImg,
        }
      : undefined,
    sysLogo: tenantSiteInfo?.sysLogo ?? tenantRecord?.sysLogo,
    sysName: tenantSiteInfo?.sysName ?? tenantRecord?.sysName,
    techSupport:
      siteInfo?.techSupport ??
      tenantSiteInfo?.techSupport ??
      tenantRecord?.techSupport,
    tenantId:
      tenantSiteInfo?.tenantId ??
      tenantRecord?.tenantId ??
      tenantRecord?.id ??
      userInfo?.tenantId,
    title: siteInfo?.title ?? tenantSiteInfo?.title ?? tenantRecord?.title,
    titleImg:
      siteInfo?.titleImg ?? tenantSiteInfo?.titleImg ?? tenantRecord?.titleImg,
  };
}

export function sortDisplayGroups(groups: CrudPageDisplayGroupConfig[]) {
  return [...groups].toSorted(
    (left, right) =>
      (left.order ?? Number.MAX_SAFE_INTEGER) -
      (right.order ?? Number.MAX_SAFE_INTEGER),
  );
}

/** 已编号分组按 order 排列；未归属字段固定排在所有已编号分组之后。 */
export function resolveDisplayGroupOrder(
  groups: CrudPageDisplayGroupConfig[] | undefined,
  groupKey: string | undefined,
  unassignedOrder?: number,
) {
  const orderedGroups = sortDisplayGroups(groups || []);
  const index = groupKey
    ? orderedGroups.findIndex((group) => group.key === groupKey)
    : -1;
  return index >= 0
    ? (orderedGroups[index]?.order ?? index)
    : (unassignedOrder ?? orderedGroups.length);
}

export function moveDisplayGroup(
  groups: CrudPageDisplayGroupConfig[],
  group: CrudPageDisplayGroupConfig,
  offset: -1 | 1,
) {
  const orderedGroups = sortDisplayGroups(groups);
  const index = orderedGroups.indexOf(group);
  const target = orderedGroups[index + offset];
  if (!target) return false;
  [group.order, target.order] = [target.order, group.order];
  return true;
}

export function releaseDisplayGroupFields(
  fields: CrudPageDisplayFieldConfig[],
  groupKey: string,
) {
  for (const field of fields) {
    if (field.layoutGroup === groupKey) field.layoutGroup = undefined;
  }
}

export function moveDisplayFieldToGroupEnd(
  fields: CrudPageDisplayFieldConfig[],
  field: CrudPageDisplayFieldConfig,
  groupKey: string | undefined,
) {
  field.layoutGroup = groupKey;
  const siblings = fields.filter(
    (item) => item !== field && item.layoutGroup === groupKey,
  );
  field.order = Math.max(-1, ...siblings.map((item) => item.order ?? -1)) + 1;
}

export function resolveDisplayGroupExpandedFieldCount(
  fieldCount: number,
  columnCount: number,
  expandedRows: CrudPageDisplayQueryCollapsedRows | 0 | undefined,
) {
  const totalFields = Math.max(Math.floor(fieldCount || 0), 0);
  if (expandedRows === 'all') return totalFields;
  const rows = Math.min(Math.max(expandedRows || 0, 0), 10);
  const columns = Math.max(Math.floor(columnCount || 0), 1);
  return Math.min(totalFields, rows * columns);
}

function dependencySatisfied(
  rule: CrudDisplayRule | undefined,
  states: Record<string, CrudDisplayState>,
) {
  const dependencies = rule?.dependsOn;
  if (!dependencies?.fieldKeys.length) return true;
  const values = dependencies.fieldKeys.map((key) => states[key] !== 'HIDDEN');
  return values.every(Boolean);
}

function exclusionSatisfied(
  rule: CrudDisplayRule | undefined,
  states: Record<string, CrudDisplayState>,
) {
  return (rule?.exclusiveWith?.fieldKeys || []).every(
    (key) => states[key] !== 'VISIBLE',
  );
}

export function resolveDisplayStates(
  items: CrudPageDisplayFieldConfig[],
  expressionResults: Record<string, boolean> = {},
  excludedKeys: ReadonlySet<string> = new Set(),
) {
  const states: Record<string, CrudDisplayState> = Object.fromEntries([
    ...items.map((item) => [item.key, item.hidden ? 'HIDDEN' : 'VISIBLE']),
    ...[...excludedKeys].map((key) => [key, 'HIDDEN']),
  ]);
  for (let index = 0; index < items.length + 1; index += 1) {
    let changed = false;
    for (const item of items) {
      const visible =
        !excludedKeys.has(item.key) &&
        !item.hidden &&
        dependencySatisfied(item.visibility, states) &&
        exclusionSatisfied(item.visibility, states) &&
        expressionResults[item.key] !== false;
      const next = visible ? 'VISIBLE' : 'HIDDEN';
      if (states[item.key] !== next) {
        states[item.key] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return states;
}

/** 控件展示与提交资格分开；隐藏提交仍须满足原有条件依赖。 */
export function resolveDisplaySubmitKeys(
  items: CrudPageDisplayFieldConfig[],
  expressionResults: Record<string, boolean> = {},
  excludedKeys: ReadonlySet<string> = new Set(),
) {
  const states = resolveDisplayStates(items, expressionResults, excludedKeys);
  return new Set(
    items
      .filter(
        (item) =>
          !excludedKeys.has(item.key) &&
          (states[item.key] === 'VISIBLE' ||
            (item.hidden === true &&
              item.submitWhenHidden === true &&
              dependencySatisfied(item.visibility, states) &&
              exclusionSatisfied(item.visibility, states) &&
              expressionResults[item.key] !== false)),
      )
      .map((item) => item.key),
  );
}

export type CrudDisplaySubmitMode =
  | 'display-submit'
  | 'disabled-submit'
  | 'hidden-submit'
  | 'hidden-omit';

export function getDisplaySubmitMode(
  field: CrudPageDisplayFieldConfig,
): CrudDisplaySubmitMode {
  if (!field.hidden)
    return field.disabled === true ? 'disabled-submit' : 'display-submit';
  return field.submitWhenHidden === true ? 'hidden-submit' : 'hidden-omit';
}

export function setDisplaySubmitMode(
  field: CrudPageDisplayFieldConfig,
  mode: CrudDisplaySubmitMode,
) {
  field.hidden = mode === 'hidden-submit' || mode === 'hidden-omit';
  field.disabled = mode === 'disabled-submit';
  field.submitWhenHidden = mode === 'hidden-submit';
}

export function sortDisplayItems<T extends CrudPageDisplayFieldConfig>(
  items: T[],
) {
  return [...items].sort(
    (left, right) =>
      (left.order ?? Number.MAX_SAFE_INTEGER) -
      (right.order ?? Number.MAX_SAFE_INTEGER),
  );
}
