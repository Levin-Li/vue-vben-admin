import { readFileSync } from 'node:fs';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const viewsDir =
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views';

const autoInjectedScopeFields = {
  article: ['orgId'],
  brand: ['orgId'],
  'client-app': ['orgId'],
  'electronic-contract-template': ['orgId', 'ownerId'],
  'file-res': ['orgId', 'ownerId'],
  'legal-subject': ['orgId', 'ownerId'],
  'notice-process-log': ['orgId', 'ownerId'],
  partner: ['orgId', 'ownerId'],
  'tenant-site': ['orgId'],
  'user-setting': ['ownerId'],
} as const;

function getPropertyName(name: ts.PropertyName) {
  return ts.isIdentifier(name) || ts.isStringLiteral(name)
    ? name.text
    : undefined;
}

function readRequiredScopeFields(configPath: string) {
  const sourceFile = ts.createSourceFile(
    configPath,
    readFileSync(configPath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const requiredScopeFields = new Set<string>();

  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      const properties = new Map(
        node.properties
          .filter(ts.isPropertyAssignment)
          .map((property) => [getPropertyName(property.name), property.initializer]),
      );
      const key = properties.get('key');
      const required = properties.get('required');

      if (
        key &&
        required &&
        ts.isStringLiteral(key) &&
        required.kind === ts.SyntaxKind.TrueKeyword
      ) {
        requiredScopeFields.add(key.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return requiredScopeFields;
}

describe('auto-injected ownership fields', () => {
  it('does not block creation for scope fields inherited from @InjectVar request bases', () => {
    for (const [page, fields] of Object.entries(autoInjectedScopeFields)) {
      const requiredFields = readRequiredScopeFields(
        `${viewsDir}/${page}/config.ts`,
      );

      for (const field of fields) {
        expect(requiredFields, `${page}.${field}`).not.toContain(field);
      }
    }
  });
});
