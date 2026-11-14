import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const repository = resolve(root, '../..');
const views = join(
  root,
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views',
);
const controllers = join(repository, 'admin-api/src/main/java');
const services = join(repository, 'services/src/main/java');
const modules = new Map();

// 每项同时核对页面和预期的静态解析失败原因，其他失败仍阻断检查。
const unresolved = {
  config: '标准 CRUD 页面缺少可静态识别的 config.ts',
  field: '不能静态解析属性 key',
  service: 'apiService 不是可静态解析的服务实例',
};
const reviewedBoundaries = new Map([
  ['channel-partner', [unresolved.field, '与合作伙伴公共页面共用动态字段构造']],
  [
    'customer',
    [unresolved.field, '法律主体对象组及合作伙伴字段依当前模式计算'],
  ],
  [
    'data-model-record',
    [unresolved.config, '详情契约来自运行时选择的数据模型'],
  ],
  ['demo', [unresolved.field, '四层嵌套字段由函数构造']],
  [
    'domain-data-dynamic-model',
    [unresolved.config, '模型定义页面通过 definition-crud-adapter 构造配置'],
  ],
  [
    'invitation-link',
    [unresolved.service, '邀请页面封装 retrieve，响应为 InvitationLinkView'],
  ],
  ['legal-subject', [unresolved.field, '法律主体字段按对象组和页面模式生成']],
  ['org-user', [unresolved.config, '组织侧栏按当前组织生成用户 CRUD 配置']],
  [
    'supplier-partner',
    [unresolved.field, '与合作伙伴公共页面共用动态字段构造'],
  ],
]);

function* files(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

function parseModule(path) {
  if (!modules.has(path)) {
    modules.set(
      path,
      ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      ),
    );
  }
  return modules.get(path);
}

// 只解析字面量、同文件常量及相对导入的常量，保持检查与运行环境无关。
function initializer(file, name) {
  for (const statement of file.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !(statement.declarationList.flags & ts.NodeFlags.Const)
    ) {
      continue;
    }
    const declaration = statement.declarationList.declarations.find(
      (item) => ts.isIdentifier(item.name) && item.name.text === name,
    );
    if (declaration) return declaration.initializer;
  }
}

function binding(identifier) {
  const file = identifier.getSourceFile();
  const local = initializer(file, identifier.text);
  if (local) return local;
  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.moduleSpecifier.text.startsWith('.') ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }
    const specifier = statement.importClause.namedBindings.elements.find(
      (item) => item.name.text === identifier.text,
    );
    if (!specifier) continue;
    const source = resolve(
      dirname(file.fileName),
      statement.moduleSpecifier.text,
    );
    const path = [`${source}.ts`, join(source, 'index.ts')].find((candidate) =>
      existsSync(candidate),
    );
    if (path) {
      return initializer(
        parseModule(path),
        specifier.propertyName?.text ?? specifier.name.text,
      );
    }
  }
}

function unwrap(node) {
  while (
    node &&
    (ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isParenthesizedExpression(node))
  ) {
    node = node.expression;
  }
  return node;
}

function constant(node, visited = new Set()) {
  node = unwrap(node);
  if (!node || !ts.isIdentifier(node)) return node;
  const declaration = binding(node);
  if (!declaration || visited.has(declaration)) return node;
  return constant(declaration, new Set([declaration, ...visited]));
}

function string(node) {
  node = constant(node);
  return node && ts.isStringLiteralLike(node) ? node.text : undefined;
}

// 按 TypeScript 展开顺序取值，拒绝可能覆盖关键信息的动态属性。
function property(object, name, visited = new Set()) {
  object = constant(object);
  if (!object || !ts.isObjectLiteralExpression(object) || visited.has(object)) {
    throw new Error(`不能静态解析属性 ${name}`);
  }
  for (const item of object.properties.toReversed()) {
    if (ts.isSpreadAssignment(item)) {
      const value = property(
        item.expression,
        name,
        new Set([object, ...visited]),
      );
      if (value) return value;
      continue;
    }
    const key = item.name;
    if (
      ts.isComputedPropertyName(key) &&
      string(key.expression) === undefined
    ) {
      throw new Error(`计算属性可能覆盖 ${name}`);
    }
    if (
      (ts.isComputedPropertyName(key) ? string(key.expression) : key.text) !==
      name
    ) {
      continue;
    }
    if (ts.isPropertyAssignment(item)) return item.initializer;
    if (ts.isShorthandPropertyAssignment(item)) return item.name;
    throw new Error(`不能静态解析属性 ${name}`);
  }
}

function* array(node, visited = new Set()) {
  node = constant(node);
  if (!node || !ts.isArrayLiteralExpression(node) || visited.has(node)) {
    throw new Error('详情字段列表包含无法静态展开的表达式');
  }
  for (const item of node.elements) {
    if (ts.isSpreadElement(item)) {
      // 无法展开的项交由字段解析记录，继续检查其余静态项。
      const spread = constant(item.expression);
      if (
        spread &&
        ts.isArrayLiteralExpression(spread) &&
        !visited.has(spread)
      ) {
        yield* array(spread, new Set([node, ...visited]));
      } else {
        yield item;
      }
    } else {
      yield item;
    }
  }
}

// 通过页面绑定的服务和控制器继承链定位实际的 retrieve 返回类型。
function serviceController(node) {
  let instance = constant(node);
  // 页面可单独接管列表，同时原样绑定服务的 retrieve。
  if (instance && ts.isObjectLiteralExpression(instance)) {
    const method = constant(property(instance, 'retrieve'));
    if (
      method &&
      ts.isCallExpression(method) &&
      ts.isPropertyAccessExpression(method.expression) &&
      method.expression.name.text === 'bind' &&
      ts.isPropertyAccessExpression(method.expression.expression) &&
      method.expression.expression.name.text === 'retrieve' &&
      method.arguments.length === 1 &&
      method.arguments[0].getText() ===
        method.expression.expression.expression.getText()
    ) {
      instance = constant(method.arguments[0]);
    }
  }
  if (
    !instance ||
    !ts.isNewExpression(instance) ||
    !ts.isIdentifier(instance.expression)
  ) {
    throw new Error(unresolved.service);
  }
  const declaration = instance
    .getSourceFile()
    .statements.find(
      (item) =>
        ts.isClassDeclaration(item) &&
        item.name?.text === instance.expression.text,
    );
  const service = declaration && serviceMetadata(declaration);
  if (service) return service;
  throw new Error('apiService 缺少可解析的 @Service.controllerClass');
}

function serviceMetadata(declaration) {
  for (const decorator of ts.getDecorators(declaration) ?? []) {
    const call = decorator.expression;
    if (ts.isCallExpression(call) && call.expression.getText() === 'Service') {
      const path = string(property(call.arguments[0], 'controllerClass'));
      const basePath = string(property(call.arguments[0], 'basePath'));
      if (path) return { path, basePath, declaration };
    }
  }
}

function getRetrievePath(service) {
  const retrieve = service.declaration.members.find(
    (member) =>
      ts.isMethodDeclaration(member) && member.name.getText() === 'retrieve',
  );
  if (!retrieve) return;
  // 只识别服务方法中唯一的字面量请求路径，动态 HTTP 分派需要人工复核。
  const calls = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
      /^(?:get|post|put|patch|deleteRequest)$/.test(node.expression.name.text)
    ) {
      calls.push({
        method: node.expression.name.text,
        path: string(node.arguments[0]),
      });
    }
    ts.forEachChild(node, visit);
  }
  if (retrieve.body) visit(retrieve.body);
  if (calls.length === 1) return calls[0];
}

function resolveService(config, apiRoot) {
  const serviceNode = property(config, 'apiService');
  const detailPathNode = property(config, 'detailPath');
  const detailPath = string(detailPathNode);
  if (detailPathNode && detailPath === undefined) {
    throw new Error('详情路径无法静态验证');
  }
  if (serviceNode) {
    const service = serviceController(serviceNode);
    const retrieve = getRetrievePath(service);
    if (retrieve?.path !== 'retrieve') {
      throw new Error('页面服务的 retrieve 请求路径无法验证');
    }
    if (
      detailPath &&
      (retrieve.method !== 'get' ||
        detailPath !== `${service.basePath}/retrieve`)
    ) {
      throw new Error('页面显式详情路径与服务的 GET retrieve 路径不一致');
    }
    return service;
  }

  // 公共页面没有服务实例时，使用 apiBase + /retrieve 直接 GET。
  const apiBase = string(property(config, 'apiBase'));
  const endpoint = detailPath || (apiBase && `${apiBase}/retrieve`);
  const candidates = [];
  if (endpoint && existsSync(apiRoot)) {
    for (const path of files(apiRoot)) {
      if (!path.endsWith('-service.ts')) continue;
      for (const declaration of parseModule(path).statements) {
        if (!ts.isClassDeclaration(declaration)) continue;
        const service = serviceMetadata(declaration);
        if (service && endpoint === `${service.basePath}/retrieve`) {
          const retrieve = getRetrievePath(service);
          if (retrieve?.method === 'get' && retrieve.path === 'retrieve')
            candidates.push(service);
        }
      }
    }
  }
  if (candidates.length === 1) return candidates[0];
  throw new Error('无法为默认详情 GET 路径唯一定位控制器');
}

function javaIndex(directory, include) {
  return new Map(
    [...files(directory)]
      .filter((path) => include(path))
      .map((file) => [
        relative(directory, file)
          .replaceAll('/', '.')
          .replace(/\.java$/, ''),
        file,
      ]),
  );
}

function javaParent(source) {
  return source.match(/\bclass\s+\w+\s+extends\s+([\w.]+)/)?.[1];
}

function javaType(index, source, name) {
  if (name.includes('.')) return index.get(name);
  const pkg = source.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1];
  const imports = [...source.matchAll(/^\s*import\s+([\w.*]+)\s*;/gm)].map(
    ([, imported]) => imported,
  );
  const explicit = imports.find((imported) => imported.endsWith(`.${name}`));
  if (explicit) return index.get(explicit);
  const samePackage = index.get(`${pkg}.${name}`);
  if (samePackage) return samePackage;
  const wildcardMatches = imports
    .filter((imported) => imported.endsWith('.*'))
    .map((imported) => index.get(imported.slice(0, -1) + name))
    .filter(Boolean);
  if (wildcardMatches.length === 1) return wildcardMatches[0];
}

function javaSource(path) {
  if (!path) throw new Error('无法定位 Java 源文件');
  return readFileSync(path, 'utf8').replaceAll(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (match, quoted) => quoted ?? match.replaceAll(/[^\n]/g, ' '),
  );
}

function retrieveModel(controllerIndex, infoIndex, path) {
  for (const visited = new Set(); path && !visited.has(path); ) {
    visited.add(path);
    const source = javaSource(path);
    const methods = [...source.matchAll(/\bretrieve\s*\(/g)].filter((match) => {
      const prefix = source.slice(0, match.index).split(/[{};]/).at(-1);
      return /\bpublic\b/.test(prefix);
    });
    if (methods.length > 0) {
      const prefix = source.slice(0, methods[0].index).split(/[{};]/).at(-1);
      const type = prefix.match(
        /\bpublic\s+ApiResp\s*<\s*([\w.]+Info)\s*>\s*$/,
      )?.[1];
      const model = type && javaType(infoIndex, source, type);
      if (methods.length === 1 && model) return model;
      throw new Error(`retrieve 返回类型无法验证（${basename(path)}）`);
    }
    const parent = javaParent(source);
    path = parent && javaType(controllerIndex, source, parent);
  }
  throw new Error('无法定位控制器继承链中的 retrieve');
}

// 识别生成 DTO 的顶层字段，读取注解及继承属性，排除明确不序列化的字段。
export function responseFields(index, path, visited = new Set()) {
  if (visited.has(path)) throw new Error('响应模型继承链存在循环');
  const source = javaSource(path);
  const parent = javaParent(source);
  const fields = parent
    ? responseFields(
        index,
        javaType(index, source, parent),
        new Set([path, ...visited]),
      )
    : new Map();
  const declaration = source.match(/\bclass\s+\w[^{}]*\{/);
  if (!declaration) throw new Error(`无法定位响应模型类（${basename(path)}）`);
  const body = source.slice(declaration.index + declaration[0].length);
  let start = 0;
  let braces = 0;
  let parentheses = 0;
  for (const token of body.matchAll(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[{}();]/g,
  )) {
    const [symbol] = token;
    if (symbol === '(') parentheses++;
    if (symbol === ')') parentheses--;
    if (parentheses > 0) continue;
    if (symbol === '{') braces++;
    if (symbol === '}' && --braces === 0) start = token.index + 1;
    if (symbol !== ';' || braces !== 0) continue;
    const member = body.slice(start, token.index).trim();
    start = token.index + 1;
    const declaration = member.replace(
      /^\s*(?:@[\w.]+(?:\s*\((?:[^()"']|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\([^()]*\))*\))?\s*)+/,
      '',
    );
    if (/\b(?:static|transient)\s/.test(declaration)) continue;
    const key = declaration.match(
      /^[\w.$?<>,[\]\s]+?\s(\w+)\s*(?:=[\s\S]*)?$/,
    )?.[1];
    if (!key) throw new Error(`无法解析响应模型字段（${basename(path)}）`);
    if (
      /@(?:[\w.]+\.)?JsonIgnore\b(?!\s*\(\s*(?:value\s*=\s*)?false)/.test(
        member,
      ) ||
      /@(?:[\w.]+\.)?JsonProperty\([^)]*access\s*=\s*[\w.]*WRITE_ONLY/.test(
        member,
      )
    ) {
      fields.delete(key);
      continue;
    }
    const serializedKey =
      member.match(
        /@(?:[\w.]+\.)?JsonProperty\(\s*(?:value\s*=\s*)?"([^"]+)"/,
      )?.[1] ?? key;
    const title = member.match(
      /@Schema\([\s\S]*?\btitle\s*=\s*"((?:\\.|[^"\\])*)"/,
    )?.[1];
    fields.set(serializedKey, title);
  }
  return fields;
}

export function declarations(config) {
  const map = new Map();
  let unsupported;
  for (const fieldList of ['fields', 'detailFields', 'detailExtraFields']) {
    const list = property(config, fieldList);
    if (!list) continue;
    for (const field of array(list)) {
      try {
        const key = string(property(field, 'key'));
        if (!key) throw new Error('详情字段包含无法静态解析的 key');
        map.set(key, {
          hidden:
            constant(property(field, 'detail'))?.kind ===
            ts.SyntaxKind.FalseKeyword,
          label: string(property(field, 'label')),
        });
      } catch (error) {
        unsupported ??= error.message;
      }
    }
  }
  return { map, unsupported };
}

function pageConfigs(file) {
  const configs = [];
  function visit(node) {
    if (
      ts.isObjectLiteralExpression(node) &&
      node.properties.some((item) => item.name?.getText() === 'apiBase')
    ) {
      configs.push(node);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return configs;
}

export function check({
  frontendRoot = root,
  backendRoot = repository,
  viewsRoot = views,
  controllerRoot = controllers,
  serviceRoot = services,
  apiRoot = resolve(viewsRoot, '../api'),
} = {}) {
  const controllerIndex = javaIndex(controllerRoot, (path) =>
    path.endsWith('Controller.java'),
  );
  const infoIndex = javaIndex(
    serviceRoot,
    (path) => path.includes('/info/') && path.endsWith('Info.java'),
  );
  const results = [];
  const pageDirs = new Set(
    [...files(viewsRoot)]
      .filter(
        (path) =>
          basename(path) === 'index.vue' || basename(path) === 'config.ts',
      )
      .map((path) => dirname(path)),
  );
  for (const directory of [...pageDirs].toSorted()) {
    const path = join(directory, 'config.ts');
    const entry = join(directory, 'index.vue');
    const file = existsSync(path) ? parseModule(path) : undefined;
    const configs = file ? pageConfigs(file) : [];
    if (
      configs.length === 0 &&
      existsSync(entry) &&
      /<(?:Dynamic)?CrudPage\b/.test(readFileSync(entry, 'utf8'))
    ) {
      configs.push(undefined);
    }
    for (const config of configs) {
      const result = {
        page: relative(viewsRoot, directory),
        file: relative(frontendRoot, config ? path : entry),
        line: config
          ? file.getLineAndCharacterOfPosition(config.getStart()).line + 1
          : 1,
        issues: [],
      };
      results.push(result);
      try {
        if (!config) throw new Error(unresolved.config);
        if (
          constant(property(config, 'allowRetrieve'))?.kind ===
          ts.SyntaxKind.FalseKeyword
        ) {
          result.excluded = '页面显式禁用标准详情';
          continue;
        }
        const service = resolveService(config, apiRoot);
        const model = retrieveModel(
          controllerIndex,
          infoIndex,
          controllerIndex.get(service.path),
        );
        result.model = relative(backendRoot, model);
        const backendFields = responseFields(infoIndex, model);
        const frontendFields = declarations(config);
        if (frontendFields.unsupported) {
          result.unsupported = frontendFields.unsupported;
        }
        for (const [key, title] of backendFields) {
          const field = frontendFields.map.get(key);
          if (!field) {
            result.issues.push({ key, title, type: '未声明详情字段' });
          } else if (
            !field.hidden &&
            !/\p{Script=Han}/u.test(field.label ?? '')
          ) {
            result.issues.push({ key, title, type: '缺少静态中文标题' });
          }
        }
      } catch (error) {
        result.unsupported = error.message;
      }
      const [expected, reason] = reviewedBoundaries.get(result.page) || [];
      if (expected && result.unsupported === expected) {
        result.boundary = reason;
      }
    }
  }
  if (results.length === 0) throw new Error('未发现待检查的标准 CRUD 配置');
  return results;
}

// 门禁失败定位到页面和字段，已审查边界计数单独展示。
function main() {
  const results = check();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    for (const {
      file,
      line,
      issues,
      model,
      excluded,
      unsupported,
      boundary,
    } of results) {
      if (excluded)
        process.stdout.write(`${file}:${line} [不适用] ${excluded}\n`);
      if (unsupported) {
        process.stderr.write(
          `${file}:${line} [无法验证] ${unsupported}${boundary ? `（已记录边界：${boundary}）` : ''}\n`,
        );
      }
      for (const { key, title, type } of boundary ? [] : issues) {
        process.stderr.write(
          `${file}:${line} [${type}] ${key}（${title ?? '后端无静态 @Schema.title'}，${basename(model)}）\n`,
        );
      }
    }
    const verified = results.filter(
      ({ model, issues, unsupported }) =>
        model && issues.length === 0 && !unsupported,
    ).length;
    const boundaries = results.filter(({ boundary }) => boundary).length;
    const exclusions = results.filter(({ excluded }) => excluded).length;
    process.stdout.write(
      `CRUD 详情静态字段契约检查完成，${verified}/${results.length} 项通过，${boundaries} 项已记录边界，${exclusions} 项不适用\n`,
    );
  }
  if (
    results.some(
      ({ issues, unsupported, boundary }) =>
        !boundary && (issues.length > 0 || unsupported),
    )
  ) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
