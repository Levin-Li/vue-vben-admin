import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const viewsRoot = join(
  root,
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views',
);
const bpmRoot = join(root, 'packages/business/bpm-runtime-ui/src');
const moduleRoot = join(viewsRoot, '..');
const auditedRoutes = new Set(
  JSON.parse(
    readFileSync(join(root, 'scripts/admin-page-inventory.json'), 'utf8'),
  ).routes.map((route) => resolve(moduleRoot, route.view)),
);
const dynamicCrudPage = join(
  root,
  'packages/business/admin-framework/src/framework-commons/shared/dynamic-crud-page.vue',
);
const errors = [];

function* files(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

function property(object, name) {
  return object.properties.find(
    (item) =>
      ts.isPropertyAssignment(item) &&
      (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) &&
      item.name.text === name,
  )?.initializer;
}

function checkConfig(path, source) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const fields = property(node, 'fields');
      const width = property(node, 'modalWidth');
      const maxColumns = property(node, 'formMaxColumns');
      if (
        fields &&
        ts.isArrayLiteralExpression(fields) &&
        width &&
        ts.isNumericLiteral(width) &&
        Number(width.text) < 960 &&
        !(
          maxColumns &&
          ts.isNumericLiteral(maxColumns) &&
          maxColumns.text === '1'
        )
      ) {
        const formFields = fields.elements.filter(
          (field) =>
            ts.isObjectLiteralExpression(field) &&
            property(field, 'form')?.kind !== ts.SyntaxKind.FalseKeyword,
        );
        if (formFields.length >= 7) {
          errors.push(
            `${relative(root, path)}: ${formFields.length} 个表单字段的弹窗上限为 ${width.text}px，双列至少需要约 960px`,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}

const sharedSource = readFileSync(dynamicCrudPage, 'utf8');
const toolbarStart = sharedSource.indexOf('name="toolbar-extra"');
const tableStart = sharedSource.indexOf('<Table', toolbarStart);
const toolbarToTable = sharedSource.slice(toolbarStart, tableStart);
if (
  [...toolbarToTable.matchAll(/<Alert\b[^>]*>/g)].some((tag) =>
    /\btype=["']error["']/.test(tag[0]),
  )
) {
  errors.push('公共 CRUD 不得在工具栏与表格之间固定渲染列表错误 Alert');
}

for (const path of [...files(viewsRoot), ...files(bpmRoot)]) {
  if (path.endsWith('/config.ts')) {
    checkConfig(path, readFileSync(path, 'utf8'));
    continue;
  }
  if (!path.endsWith('.vue')) continue;
  const source = readFileSync(path, 'utf8');
  const formIds = new Set();
  for (const form of source.matchAll(/<A?Form(?!\.)\b[^>]*>/g)) {
    const tag = form[0];
    const id = tag.match(/\bdata-form-id=["']([^"']+)["']/)?.[1];
    if (
      !id ||
      !/\bdata-form-name=["'][^"']+["']/.test(tag) ||
      !/\s(?:id|:id)=["'][^"']+["']/.test(tag) ||
      !/\s(?:name|:name)=["'][^"']+["']/.test(tag)
    ) {
      errors.push(`${relative(root, path)}: 扩展表单缺少稳定 formId/formName`);
    } else if (formIds.has(id)) {
      errors.push(`${relative(root, path)}: 重复的扩展表单标识 ${id}`);
    } else {
      formIds.add(id);
    }
  }
  for (const form of source.matchAll(
    /<A?Form(?!\.)\b[^>]*>[\s\S]*?<\/A?Form>/g,
  )) {
    const block = form[0];
    const fieldCount = [...block.matchAll(/<A?Form\.Item\b/g)].length;
    if (fieldCount < 7) continue;
    const openingTag = block.match(/^<A?Form(?!\.)\b[^>]*>/)?.[0] || '';
    const formId = openingTag.match(/\bdata-form-id=["']([^"']+)["']/)?.[1];
    // 结算动作共用一个表单，但各分支互斥，实际同时最多展示四项。
    if (formId === 'settlement-flow-action') continue;
    const responsiveClass = /\b(?:sm|md|lg|xl|2xl):grid-cols-[2-9]\b/;
    const adaptiveGrid =
      /grid-template-columns:\s*repeat\(\s*(?:[2-9]|auto-fit|auto-fill)/;
    const cssClass = openingTag.match(/\bclass=["']([^"']+)["']/)?.[1];
    const cssRule = cssClass
      ?.split(/\s+/)
      .some((name) =>
        new RegExp(
          String.raw`\.${name.replaceAll('-', String.raw`\-`)}\s*\{[^}]*${adaptiveGrid.source}`,
        ).test(source),
      );
    if (!responsiveClass.test(block) && !adaptiveGrid.test(block) && !cssRule) {
      errors.push(
        `${relative(root, path)}: ${fieldCount} 个扩展表单字段缺少响应式多列布局`,
      );
    }
  }
  if (!auditedRoutes.has(path) && !/<(?:A?Table|CrudPage)\b/.test(source))
    continue;
  const templateStart = source.indexOf('<template>');
  if (templateStart === -1) continue;
  const beforeDialog = source
    .slice(templateStart)
    .split(/<(?:A?Modal|A?Drawer)\b/)[0];
  const listEnd = Math.max(
    ...['</Table>', '</ATable>', '</CrudPage>', '</Tabs>', '</ATabs>'].map(
      (tag) => {
        const index = beforeDialog.lastIndexOf(tag);
        return index === -1 ? 0 : index + tag.length;
      },
    ),
  );
  const pageSurface =
    listEnd > 0 ? beforeDialog.slice(0, listEnd) : beforeDialog;
  for (const tag of pageSurface.matchAll(/<A?Alert\b[^>]*>/g)) {
    if (/\btype=["']error["']/.test(tag[0])) {
      errors.push(`${relative(root, path)}: 列表页错误不得使用常驻 Alert`);
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('CRUD 页面布局与列表反馈检查通过\n');
}
