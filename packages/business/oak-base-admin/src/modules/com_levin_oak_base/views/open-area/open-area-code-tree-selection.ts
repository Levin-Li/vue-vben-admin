import type { AdministrativeAreaNode } from '@levin/admin-framework/framework-commons/shared/administrative-area-data';

import { normalizeAdministrativeAreaCode } from '@levin/admin-framework/framework-commons/shared/administrative-area-data';

function normalizeCode(value: unknown) {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    return '';
  }

  try {
    return normalizeAdministrativeAreaCode(rawValue);
  } catch {
    return rawValue;
  }
}

function getAreaPrefix(code: string) {
  if (/^\d{6}$/.test(code)) {
    if (code.endsWith('0000')) return code.slice(0, 2);
    if (code.endsWith('00')) return code.slice(0, 4);
  }

  return code;
}

export function isOpenAreaCodeCovered(rangeCode: string, areaCode: string) {
  return String(areaCode).startsWith(getAreaPrefix(String(rangeCode)));
}

export function normalizeOpenAreaCodeList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [];
  const codes = [
    ...new Set(values.map((item) => normalizeCode(item)).filter(Boolean)),
  ];

  return codes.filter(
    (code) =>
      !codes.some(
        (otherCode) =>
          otherCode !== code && isOpenAreaCodeCovered(otherCode, code),
      ),
  );
}

export function compactOpenAreaCodeList(
  value: unknown,
  areas: AdministrativeAreaNode[],
) {
  let codes = normalizeOpenAreaCodeList(value);

  const compactNode = (node: AdministrativeAreaNode) => {
    for (const child of node.children || []) {
      compactNode(child);
    }

    const children = node.children || [];
    if (
      children.length > 0 &&
      children.every((child) =>
        codes.some((code) => isOpenAreaCodeCovered(code, child.code)),
      )
    ) {
      codes = normalizeOpenAreaCodeList([
        ...codes.filter((code) => !isOpenAreaCodeCovered(node.code, code)),
        node.code,
      ]);
    }
  };

  for (const area of areas) {
    compactNode(area);
  }

  return codes;
}

export function shouldFilterOpenAreaTree(keyword: string) {
  const normalizedKeyword = keyword.trim();
  return (
    normalizedKeyword.length >= 2 &&
    !['区', '市', '省'].includes(normalizedKeyword)
  );
}

export function filterOpenAreaTree(
  areas: AdministrativeAreaNode[],
  keyword: string,
) {
  if (!shouldFilterOpenAreaTree(keyword)) {
    return areas;
  }

  const normalizedKeyword = keyword.trim();
  const filterNode = (
    node: AdministrativeAreaNode,
  ): AdministrativeAreaNode | undefined => {
    if (node.name.includes(normalizedKeyword)) {
      return node;
    }

    const children = (node.children || [])
      .map((child) => filterNode(child))
      .filter(Boolean) as AdministrativeAreaNode[];

    return children.length > 0 ? { ...node, children } : undefined;
  };

  return areas
    .map((area) => filterNode(area))
    .filter(Boolean) as AdministrativeAreaNode[];
}

export function toggleOpenAreaCode(
  currentValue: unknown,
  targetCode: string,
  checked: boolean,
) {
  const codes = normalizeOpenAreaCodeList(currentValue);

  if (checked) {
    return normalizeOpenAreaCodeList([
      ...codes.filter((code) => !isOpenAreaCodeCovered(targetCode, code)),
      targetCode,
    ]);
  }

  return codes.filter((code) => !isOpenAreaCodeCovered(code, targetCode));
}
