import { shallowRef } from 'vue';

import { message } from 'ant-design-vue';

import { requestClient } from '../runtime';
import builtInDocument from './administrative-area-data.json';

export type AdministrativeAreaLevel = 'city' | 'district' | 'province';

export interface AdministrativeAreaNode {
  children?: AdministrativeAreaNode[];
  code: string;
  level: AdministrativeAreaLevel;
  name: string;
}

export interface AdministrativeAreaDocument {
  areas: AdministrativeAreaNode[];
  source?: string;
  version?: string;
}

export interface OpenAreaContext {
  bizCategory?: string;
  bizType?: string;
  domain?: string;
}

interface AdministrativeAreaIndex {
  areas: AdministrativeAreaNode[];
  byCode: Map<string, AdministrativeAreaNode>;
  pathByCode: Map<string, AdministrativeAreaNode[]>;
}

const AREA_CODE_PATTERN = /^\d{2,6}$/;

function normalizeAreaCode(value: unknown) {
  const code = String(value ?? '').trim();
  if (!code) {
    return '';
  }
  if (!AREA_CODE_PATTERN.test(code)) {
    throw new TypeError('行政编码必须为2至6位数字');
  }
  return `${code}000000`.slice(0, 6);
}

function createIndex(
  document: AdministrativeAreaDocument,
): AdministrativeAreaIndex {
  if (!Array.isArray(document?.areas) || document.areas.length === 0) {
    throw new TypeError('行政区划数据不能为空');
  }

  const byCode = new Map<string, AdministrativeAreaNode>();
  const pathByCode = new Map<string, AdministrativeAreaNode[]>();
  const walk = (
    node: AdministrativeAreaNode,
    parentPath: AdministrativeAreaNode[],
    parentLevel?: AdministrativeAreaLevel,
  ) => {
    if (!node || !/^\d{6}$/.test(node.code) || !node.name) {
      throw new TypeError('行政区划节点格式错误');
    }
    if (!['city', 'district', 'province'].includes(node.level)) {
      throw new TypeError('行政区划节点层级错误');
    }
    if (
      (parentLevel === 'province' &&
        !['city', 'district'].includes(node.level)) ||
      (parentLevel === 'city' && node.level !== 'district') ||
      parentLevel === 'district' ||
      byCode.has(node.code)
    ) {
      throw new TypeError('行政区划树层级或编码重复');
    }
    const path = [...parentPath, node];
    byCode.set(node.code, node);
    pathByCode.set(node.code, path);
    for (const child of node.children || []) {
      walk(child, path, node.level);
    }
  };
  for (const node of document.areas) {
    walk(node, []);
  }
  return { areas: document.areas, byCode, pathByCode };
}

const areaIndex = shallowRef(
  createIndex(builtInDocument as AdministrativeAreaDocument),
);
let shownInvalidConfigMessage = false;

export function getAdministrativeAreaOptions() {
  return areaIndex.value.areas;
}

export function getAdministrativeAreaCascaderOptions() {
  const mapNode = (node: AdministrativeAreaNode): Record<string, any> => ({
    children: node.children?.map((child) => mapNode(child)),
    label: node.name,
    level: node.level,
    value: node.code,
  });
  return areaIndex.value.areas.map((node) => mapNode(node));
}

/**
 * 将页面静态声明的可选层级落实为级联节点的叶子节点。
 * 直辖市在行政区划树中只有省级节点和区县子节点，选择市级编码时该节点视为城市。
 */
export function restrictAdministrativeAreaOptionsByLevels(
  options: Record<string, any>[],
  selectableLevels: AdministrativeAreaLevel[] | undefined,
) {
  const levels = new Set(selectableLevels || []);
  if (levels.size === 0 || levels.size === 3) {
    return options;
  }

  const mapOption = (option: Record<string, any>): Record<string, any> => {
    const children = Array.isArray(option.children)
      ? option.children.map(mapOption)
      : [];
    const isDirectMunicipalityCity =
      levels.size === 1 &&
      levels.has('city') &&
      option.level === 'province' &&
      children.every((child) => child.level !== 'city');
    const isSelectable = levels.has(option.level) || isDirectMunicipalityCity;

    return {
      ...option,
      children: isSelectable
        ? undefined
        : children.length > 0
          ? children
          : undefined,
      isLeaf: isSelectable,
    };
  };

  return options.map(mapOption);
}

/**
 * 页面未声明层级时，沿用编码优先策略：已有值按其编码格式回显和选择；空值默认选择到区县。
 */
export function resolveAdministrativeAreaSelectableLevels(
  selectableLevels: AdministrativeAreaLevel[] | undefined,
  value: unknown,
): AdministrativeAreaLevel[] {
  const configuredLevels = [...new Set(selectableLevels || [])];
  if (configuredLevels.length > 0) {
    return configuredLevels;
  }

  const code = Array.isArray(value) ? value.at(-1) : value;
  try {
    const level = resolveAdministrativeAreaCodeLevel(code);
    if (level) {
      return [level];
    }
  } catch {
    // 无效或空编码按默认区县策略处理，提交前仍由原有校验负责提示。
  }

  return ['district'];
}

function normalizeOpenAreaContext(context: OpenAreaContext = {}) {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => String(value ?? '').trim()),
  ) as OpenAreaContext;
}

export function hasOpenAreaContext(context: OpenAreaContext = {}) {
  return Object.keys(normalizeOpenAreaContext(context)).length > 0;
}

export async function getCurrentOpenAreaCodes(context: OpenAreaContext = {}) {
  const record = await requestClient.get<any>('/OpenArea/current', {
    __silentError: true,
    params: normalizeOpenAreaContext(context),
  });
  return Array.isArray(record?.areaCodeList)
    ? record.areaCodeList.map((code: string) => normalizeAreaCode(code))
    : [];
}

export function filterAdministrativeAreaOptions(
  allowedCodes: string[],
): Record<string, any>[] {
  if (allowedCodes.length === 0) {
    return getAdministrativeAreaCascaderOptions();
  }
  const prefixes = allowedCodes.map((code) => {
    if (code.endsWith('0000')) return code.slice(0, 2);
    if (code.endsWith('00')) return code.slice(0, 4);
    return code;
  });
  const filterNode = (
    node: AdministrativeAreaNode,
  ): Record<string, any> | undefined => {
    const children = (node.children || [])
      .map((child) => filterNode(child))
      .filter(Boolean);
    if (
      !prefixes.some((prefix) => node.code.startsWith(prefix)) &&
      children.length === 0
    ) {
      return undefined;
    }
    return {
      children: children.length > 0 ? children : undefined,
      label: node.name,
      level: node.level,
      value: node.code,
    };
  };
  return areaIndex.value.areas
    .map((node) => filterNode(node))
    .filter((node): node is Record<string, any> => Boolean(node));
}

export function resolveAdministrativeAreaPath(value: unknown) {
  const code = normalizeAreaCode(value);
  return code ? areaIndex.value.pathByCode.get(code) || [] : [];
}

export function formatAdministrativeArea(value: unknown) {
  const code = normalizeAreaCode(value);
  if (!code) {
    return '';
  }
  const path = areaIndex.value.pathByCode.get(code);
  return path?.map((node) => node.name).join(' / ') || code;
}

export function normalizeAdministrativeAreaCode(value: unknown) {
  return normalizeAreaCode(value);
}

/**
 * 按国家行政区划编码格式识别层级；不能只以六码长度判断区县，必须优先识别省、市尾码。
 */
export function resolveAdministrativeAreaCodeLevel(
  value: unknown,
): AdministrativeAreaLevel | undefined {
  const code = String(value ?? '').trim();
  if (!code) {
    return undefined;
  }
  if (!AREA_CODE_PATTERN.test(code)) {
    throw new TypeError('行政编码必须为2至6位数字');
  }
  if (code.length === 2 || code.endsWith('0000')) {
    return 'province';
  }
  if (code.length === 4 || code.endsWith('00')) {
    return 'city';
  }
  return 'district';
}

export async function loadAdministrativeAreaOverride() {
  const setting = await requestClient.get<any>(
    '/Setting/use/areaCodes',
    { __silentError: true },
  );
  const content = String(setting?.valueContent || '').trim();
  if (!content) {
    return false;
  }
  try {
    areaIndex.value = createIndex(JSON.parse(content));
    return true;
  } catch {
    if (!shownInvalidConfigMessage) {
      shownInvalidConfigMessage = true;
      message.error('国家行政编码配置无效，已使用前端内置行政区划数据');
    }
    return false;
  }
}
