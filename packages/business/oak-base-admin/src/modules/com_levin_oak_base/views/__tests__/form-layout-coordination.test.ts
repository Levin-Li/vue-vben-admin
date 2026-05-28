import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  getFormFieldColumnSpan,
  resolveFormColumnCount,
  sortFormLayoutFields,
} from '@levin/admin-framework/framework-commons/shared/crud-form-layout';
import type { CrudFieldConfig } from '@levin/admin-framework/framework-commons/shared/types';

const viewsDir =
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views';

function listConfigFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return listConfigFiles(path);
    }

    return entry === 'config.ts' ? [path] : [];
  });
}

function getPropertyName(name: ts.PropertyName) {
  if (
    ts.isIdentifier(name) ||
    ts.isNumericLiteral(name) ||
    ts.isStringLiteral(name)
  ) {
    return name.text;
  }

  return undefined;
}

function getLiteralValue(node: ts.Expression) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }

  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    return node.operator === ts.SyntaxKind.MinusToken
      ? -Number(node.operand.text)
      : Number(node.operand.text);
  }

  return undefined;
}

function parseFieldObject(node: ts.ObjectLiteralExpression) {
  const field: Partial<CrudFieldConfig> = {};

  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const name = getPropertyName(property.name);
    const value = getLiteralValue(property.initializer);

    if (name && value !== undefined) {
      (field as Record<string, unknown>)[name] = value;
    }
  }

  return field.key ? (field as CrudFieldConfig) : undefined;
}

function parseCrudFields(source: string) {
  const sourceFile = ts.createSourceFile(
    'config.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const fields: CrudFieldConfig[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isPropertyAssignment(node) &&
      getPropertyName(node.name) === 'fields' &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const element of node.initializer.elements) {
        if (ts.isObjectLiteralExpression(element)) {
          const field = parseFieldObject(element);

          if (field) {
            fields.push(field);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return fields;
}

function getFieldFamily(field: CrudFieldConfig) {
  if (field.type === 'file' || field.type === 'image') {
    return 'upload';
  }

  if (field.type === 'string-array' || field.type === 'tags') {
    return 'list';
  }

  if (
    field.type === 'code' ||
    field.type === 'css' ||
    field.type === 'html' ||
    field.type === 'textarea'
  ) {
    return 'editor';
  }

  return field.type || 'text';
}

function getStaticAuditFieldWeight(field: CrudFieldConfig) {
  if (field.fullRow || field.span === -1) {
    return 3;
  }

  if (field.span && field.span > 1) {
    return 2;
  }

  if (field.type === 'switch') {
    return 0.6;
  }

  if (
    field.type === 'code' ||
    field.type === 'css' ||
    field.type === 'file' ||
    field.type === 'html' ||
    field.type === 'image' ||
    field.type === 'textarea'
  ) {
    return 2;
  }

  if (field.type === 'string-array' || field.type === 'tags') {
    return 3;
  }

  return 1;
}

function getFormFields(fields: CrudFieldConfig[], mode: 'create' | 'edit') {
  return fields.filter(
    (field) =>
      field.form !== false &&
      (mode === 'create'
        ? field.formCreate !== false
        : field.formEdit !== false),
  );
}

function buildFormRows(fields: CrudFieldConfig[]) {
  const sortedFields = sortFormLayoutFields(fields);
  const columns = resolveFormColumnCount({
    fields: sortedFields,
    modalAvailableWidth: 1280,
    viewportHeight: 900,
    viewportWidth: 1440,
  });
  const rows: Array<
    Array<{
      family: string;
      field: CrudFieldConfig;
      span: number;
      weight: number;
    }>
  > = [];
  let currentRow: (typeof rows)[number] = [];
  let usedColumns = 0;

  function flushRow() {
    if (currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
      usedColumns = 0;
    }
  }

  for (const field of sortedFields) {
    if (field.layoutNewRow) {
      flushRow();
    }

    const span = getFormFieldColumnSpan(field, columns);

    if (usedColumns > 0 && usedColumns + span > columns) {
      flushRow();
    }

    currentRow.push({
      family: getFieldFamily(field),
      field,
      span,
      weight: getStaticAuditFieldWeight(field),
    });
    usedColumns += span;

    if (usedColumns >= columns) {
      flushRow();
    }
  }

  flushRow();

  return rows;
}

function describeRow(
  row: Array<{ family: string; field: CrudFieldConfig; span: number }>,
) {
  return row
    .map(
      (item) => `${item.field.key}:${item.field.type || 'text'}:${item.span}`,
    )
    .join(' | ');
}

function collectCoordinationIssues(
  file: string,
  mode: 'create' | 'edit',
  fields: CrudFieldConfig[],
) {
  const rows = buildFormRows(getFormFields(fields, mode));
  const issues: string[] = [];

  rows.forEach((row, rowIndex) => {
    const highFields = row.filter((item) => item.weight >= 2 || item.span > 1);
    const families = new Set(row.map((item) => item.family));
    const nextRow = rows[rowIndex + 1];

    if (!nextRow || highFields.length === 0 || families.size <= 1) {
      return;
    }

    const splitField = highFields.find((item) =>
      nextRow.some(
        (nextItem) =>
          nextItem.family === item.family &&
          (nextItem.weight >= 2 || nextItem.span > 1),
      ),
    );

    if (splitField) {
      issues.push(
        `${file} ${mode} row ${rowIndex + 1}: ${describeRow(row)} -> ${describeRow(nextRow)}`,
      );
    }
  });

  return issues;
}

function isCompactHighComponent(field: CrudFieldConfig) {
  return [
    'file',
    'image',
    'json',
    'string-array',
    'tags',
  ].includes(String(field.type || ''));
}

function isAllowedFullRowHighComponent(file: string, field: CrudFieldConfig) {
  return (
    file.endsWith('client-app/config.ts') &&
    ['allowedIpList', 'allowedPathPatterns'].includes(field.key)
  );
}

describe('form layout coordination', () => {
  it('keeps create and edit forms free of obvious high-component row breaks', () => {
    const issues = listConfigFiles(viewsDir).flatMap((file) => {
      const fields = parseCrudFields(readFileSync(file, 'utf8'));
      const relativeFile = file.replace(`${viewsDir}/`, '');

      return [
        ...collectCoordinationIssues(relativeFile, 'create', fields),
        ...collectCoordinationIssues(relativeFile, 'edit', fields),
      ];
    });

    expect(issues).toEqual([]);
  });

  it('keeps compact high components from forcing full-width form rows', () => {
    const offenders = listConfigFiles(viewsDir).flatMap((file) => {
      const fields = parseCrudFields(readFileSync(file, 'utf8'));
      const relativeFile = file.replace(`${viewsDir}/`, '');

      return fields
        .filter(
          (field) =>
            isCompactHighComponent(field) &&
            (field.fullRow === true || field.span === -1) &&
            !isAllowedFullRowHighComponent(file, field),
        )
        .filter(
          (field) =>
            getFormFields([field], 'create').length > 0 ||
            getFormFields([field], 'edit').length > 0,
        )
        .map((field) => `${relativeFile}:${field.key}`);
    });

    expect(offenders).toEqual([]);
  });
});
