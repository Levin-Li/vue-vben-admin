import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const moduleRoot = join(
  root,
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base',
);
const routeFile = join(moduleRoot, 'admin-crud.ts');
const inventoryArg = process.argv.indexOf('--inventory');
const inventoryFile =
  inventoryArg === -1
    ? join(root, 'scripts/admin-page-inventory.json')
    : resolve(process.argv[inventoryArg + 1]);
const inventory = JSON.parse(readFileSync(inventoryFile, 'utf8'));
const source = ts.createSourceFile(
  routeFile,
  readFileSync(routeFile, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
const declarations = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    declarations.set(node.name.text, node.initializer);
  }
  ts.forEachChild(node, visit);
}
visit(source);
const unwrap = (node) => (ts.isAsExpression(node) ? node.expression : node);
const literal = (node) => (node && ts.isStringLiteral(node) ? node.text : '');
const errors = [];

const resources = new Set();
for (const entry of unwrap(declarations.get('oakBaseAdminCrudResources'))
  .elements) {
  if (!ts.isObjectLiteralExpression(entry)) continue;
  const resource = entry.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      property.name.getText(source) === 'resource',
  );
  if (resource) resources.add(literal(resource.initializer));
}

const viewMap = new Map();
for (const entry of unwrap(declarations.get('oakBaseAdminResourceViewMap'))
  .properties) {
  if (!ts.isPropertyAssignment(entry)) continue;
  const resource = entry.name.getText(source).replaceAll("'", '');
  const view = entry.initializer
    .getText(source)
    .match(/import\(['"]([^'"]+)['"]\)/)?.[1];
  if (view) viewMap.set(resource, view);
}

const groupResources = new Set();
for (const group of unwrap(declarations.get('menuGroups')).elements) {
  if (!ts.isArrayLiteralExpression(group)) continue;
  const children = group.elements[2];
  if (!ts.isArrayLiteralExpression(children)) continue;
  for (const child of children.elements) {
    if (ts.isStringLiteral(child)) groupResources.add(child.text);
  }
}
for (const item of unwrap(declarations.get('oakWorkflowResources')).elements) {
  if (ts.isStringLiteral(item)) groupResources.add(item.text);
}

const classified = new Map();
for (const entry of inventory.routes || []) {
  if (classified.has(entry.resource)) {
    errors.push(`页面清单重复：${entry.resource}`);
  }
  classified.set(entry.resource, entry);
}
const validClasses = new Set([
  'audit',
  'dashboard',
  'demo',
  'designer',
  'manual-crud',
  'message',
  'settings',
  'shared-crud',
  'tree',
  'workbench',
  'workflow',
]);

function checkServiceActions(entry, view) {
  const configPath = join(moduleRoot, dirname(view), 'config.ts');
  if (!existsSync(configPath)) return;
  const config = readFileSync(configPath, 'utf8');
  const serviceName = config.match(/\bapiService:\s*(\w+)/)?.[1];
  if (!serviceName) return;
  const serviceImport = [
    ...config.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g),
  ].find(([, names]) =>
    names.split(',').some((name) => name.trim() === serviceName),
  );
  if (!serviceImport) return;
  const servicePath = resolve(dirname(configPath), `${serviceImport[2]}.ts`);
  if (!existsSync(servicePath)) return;
  const service = ts.createSourceFile(
    servicePath,
    readFileSync(servicePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const methods = new Set();
  function collect(node) {
    if (ts.isMethodDeclaration(node) && node.name) {
      methods.add(node.name.getText(service));
    }
    ts.forEachChild(node, collect);
  }
  collect(service);
  for (const [method, flag, label] of [
    ['update', 'allowEdit', '编辑'],
    ['delete', 'allowDelete', '删除'],
    ['retrieve', 'allowRetrieve', '详情'],
  ]) {
    if (
      !methods.has(method) &&
      !new RegExp(String.raw`${flag}:\s*false`).test(config)
    ) {
      errors.push(
        `${entry.resource}: 服务未提供 ${method}，须关闭默认${label}动作`,
      );
    }
  }
}

for (const [resource, view] of viewMap) {
  const entry = classified.get(resource);
  if (!resources.has(resource) || !groupResources.has(resource)) {
    errors.push(`路由资源缺少定义或业务分组：${resource}`);
  }
  if (!entry) {
    errors.push(`页面尚未审计：${resource}`);
    continue;
  }
  if (entry.view !== view || !validClasses.has(entry.classification)) {
    errors.push(`页面清单路径或分类无效：${resource}`);
  }
  if (!entry.reason?.trim() || !existsSync(join(moduleRoot, view))) {
    errors.push(`页面缺少依据或文件：${resource}`);
  }
  if (entry.classification === 'manual-crud' && !entry.reviewTask) {
    errors.push(`手写 CRUD 缺少明确迁移任务：${resource}`);
  }
  if (entry.classification === 'manual-crud') {
    const body = readFileSync(join(moduleRoot, view), 'utf8');
    if (body.includes('<CrudPage')) {
      errors.push(`已迁移公共 CRUD 但清单未更新：${resource}`);
    }
  }
  if (entry.classification === 'shared-crud') {
    const body = readFileSync(join(moduleRoot, view), 'utf8');
    if (
      ![
        'CrudPage',
        'SettingCrudPage',
        'PartnerCrudPage',
        'SimpleContentResourcePage',
      ].some((component) => body.includes(`<${component}`))
    ) {
      errors.push(`声明公共 CRUD 但未使用公共页面组件：${resource}`);
    }
    checkServiceActions(entry, view);
  }
}
for (const resource of classified.keys()) {
  if (!viewMap.has(resource)) errors.push(`页面清单已失效：${resource}`);
}

const viewRoot = join(moduleRoot, 'views');
const routed = new Set(
  [...viewMap.values()].map((view) => resolve(moduleRoot, view)),
);
const embedded = new Set(
  (inventory.embedded || []).map((entry) => resolve(moduleRoot, entry.view)),
);
for (const folder of readdirSync(viewRoot, { withFileTypes: true })) {
  if (!folder.isDirectory()) continue;
  const path = join(viewRoot, folder.name, 'index.vue');
  if (existsSync(path) && !routed.has(path) && !embedded.has(path)) {
    errors.push(`内嵌页面尚未审计：${folder.name}`);
  }
}
for (const path of embedded) {
  if (!existsSync(path) || routed.has(path) || dirname(path) === viewRoot) {
    errors.push(`内嵌页面清单已失效：${path}`);
  }
}

const frameworkRoot = join(
  root,
  'packages/business/admin-framework/src/framework-commons/app/router/routes',
);
const frameworkPages = new Set();
for (const file of [
  'core.ts',
  'modules/home.ts',
  'modules/demos.ts',
  'modules/my-messages.ts',
  'modules/system.ts',
]) {
  const routeSource = ts.createSourceFile(
    file,
    readFileSync(join(frameworkRoot, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const variables = new Map();
  for (const statement of routeSource.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        variables.set(declaration.name.text, declaration.initializer);
      }
    }
  }
  function routeProperty(node, key) {
    return (
      node.properties.find(
        (property) =>
          (ts.isPropertyAssignment(property) ||
            ts.isShorthandPropertyAssignment(property)) &&
          property.name.getText(routeSource) === key,
      )?.initializer ||
      node.properties.find(
        (property) =>
          ts.isShorthandPropertyAssignment(property) &&
          property.name.text === key,
      )?.name
    );
  }
  function collectRoute(node, parent = '') {
    if (!ts.isObjectLiteralExpression(node)) return;
    const pathValue = routeProperty(node, 'path');
    if (!pathValue) return;
    const resolvedPath =
      pathValue && ts.isIdentifier(pathValue)
        ? variables.get(pathValue.text)
        : pathValue;
    const segment = literal(resolvedPath);
    const fullPath = segment.startsWith('/')
      ? segment
      : `${parent.replace(/\/$/, '')}/${segment}`;
    const component = routeProperty(node, 'component');
    if (component?.getText(routeSource).includes('resolveAdminPage(')) {
      frameworkPages.add(fullPath);
    }
    const children = routeProperty(node, 'children');
    if (children && ts.isArrayLiteralExpression(children)) {
      for (const child of children.elements) collectRoute(child, fullPath);
    }
  }
  for (const name of ['coreRoutes', 'fallbackNotFoundRoute', 'routes']) {
    const value = variables.get(name);
    if (value && ts.isArrayLiteralExpression(value)) {
      for (const route of value.elements) collectRoute(route);
    } else if (value) {
      collectRoute(value);
    }
  }
}
const declaredFrameworkPages = new Set([
  ...(inventory.frameworkAliases || []),
  ...(inventory.frameworkRoutes || []),
]);
for (const path of frameworkPages) {
  if (!declaredFrameworkPages.has(path))
    errors.push(`公共框架页面尚未审计：${path}`);
}
for (const path of declaredFrameworkPages) {
  if (!frameworkPages.has(path)) errors.push(`公共框架页面清单已失效：${path}`);
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `页面清单覆盖 ${viewMap.size} 个 Oak 路由、${embedded.size} 个内嵌入口与 ${frameworkPages.size} 个公共框架 URL\n`,
  );
}
