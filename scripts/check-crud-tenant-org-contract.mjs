import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

import {
  array,
  constant,
  files,
  getServiceOperation,
  javaIndex,
  javaParent,
  javaSource,
  javaType,
  pageConfigs,
  parseModule,
  property,
  responseFields,
  serviceController,
  serviceMetadata,
  string,
} from './check-crud-detail-field-contract.mjs';

const frontendRoot = resolve(import.meta.dirname, '..');
const backendRoot = resolve(frontendRoot, '../..');
const operationVerbs = {
  create: 'Post',
  list: 'Get',
  retrieve: 'Get',
  update: 'Put',
};
const scenes = [
  {
    view: 'query',
    operation: 'list',
    disabled: 'allowQuery',
    path: 'listPath',
  },
  {
    view: 'list',
    operation: 'list',
    disabled: 'allowQuery',
    path: 'listPath',
    response: true,
  },
  {
    view: 'create',
    operation: 'create',
    disabled: 'allowCreate',
    path: 'createPath',
  },
  {
    view: 'edit',
    operation: 'update',
    disabled: 'allowEdit',
    path: 'updatePath',
  },
  {
    view: 'detail',
    operation: 'retrieve',
    disabled: 'allowRetrieve',
    path: 'detailPath',
    response: true,
  },
];

// 仅匹配已知归属字段。组织分类、组织类型和其他匹配条件保持原有语义。
const ownershipKeys = new Set([
  'belongOrgId',
  'organizationId',
  'orgId',
  'owningOrgId',
  'parentOrgId',
  'sourceOrgId',
  'targetOrgId',
  'tenantId',
]);
const displayKeys = new Map([
  ['belongOrgId', ['belongOrgName', 'belongOrg']],
  ['organizationId', ['organizationName', 'organization']],
  ['orgId', ['orgName', 'org']],
  ['owningOrgId', ['owningOrgName', 'owningOrg']],
  ['parentOrgId', ['parentOrgName', 'parentOrg']],
  ['sourceOrgId', ['sourceOrgName', 'sourceOrg']],
  ['targetOrgId', ['targetOrgName', 'targetOrg']],
  ['tenantId', ['tenantName', 'tenant']],
]);

// 例外仅对同一页面、接口、后端模型和字段生效，以实际业务投影为依据。
const reviewedExclusions = [
  {
    page: 'address',
    view: 'edit',
    model: 'UpdateAddressReq.java',
    key: 'orgId',
    reason:
      'BizAddressController.update 以原组织范围校验地址，页面仅展示原组织且显式省略编辑提交',
  },
  {
    page: 'electronic-invoice',
    view: 'create',
    model: 'ElectronicInvoiceIssueReq.java',
    key: 'orgId',
    reason: 'BizEInvoiceServiceImpl.issue 从获授权销方的业务组织生成发票归属',
  },
  {
    page: 'electronic-invoice-provider-connection',
    view: 'query',
    model: 'QueryEInvoiceProviderConnectionReq.java',
    key: 'orgId',
    reason:
      'BizInvoiceAuthorizationSubjectAccessImpl.listAuthorized 明确拒绝组织范围参数，并按租户及获授权主体查询',
  },
  {
    page: 'electronic-invoice-provider-connection',
    view: 'list',
    model: 'EInvoiceProviderConnectionInfo.java',
    key: 'orgId',
    reason:
      'BizInvoiceAuthorizationSubjectAccessImpl.safeInfo 的列表投影不返回组织归属',
  },
  {
    page: 'inbox',
    view: 'query',
    model: 'QueryInboxReq.java',
    key: 'tenantId',
    reason:
      'inbox/index.vue 的 changeScope 从授权组织节点同时取得租户和组织范围，租户通过 defaultQuery 传入',
  },
  {
    page: 'user-setting',
    view: 'query',
    model: 'QueryUserPersonalSettingReq.java',
    key: 'tenantId',
    reason:
      'BizUserPersonalSettingController.checkRequest 固定当前用户，个人配置入口保留当前会话租户范围',
  },
  {
    page: 'user-setting',
    view: 'create',
    model: 'CreateUserPersonalSettingReq.java',
    key: 'tenantId',
    reason: '个人配置新建使用当前用户上下文，接口使用指南限定当前用户及其租户',
  },
  {
    page: 'workflow-request',
    view: 'query',
    model: 'QueryWorkflowRequestReq.java',
    key: 'tenantId',
    reason:
      'WorkflowRequestService.requestScope 从页面的已授权组织选项传租户，控制器 context 校验范围',
  },
  {
    page: 'workflow-request',
    view: 'query',
    model: 'QueryWorkflowRequestReq.java',
    key: 'orgId',
    reason:
      'WorkflowRequestService.requestScope 从页面的已授权组织选项传组织，控制器 context 校验范围',
  },
  {
    page: 'workflow-request',
    view: 'edit',
    model: 'SaveWorkflowRequestReq.java',
    key: 'orgId',
    reason:
      'BizWorkflowRequestController.update 以组织定位已有申请，服务仅写入业务值',
  },
];

function applyReviewedExclusions(result) {
  for (const { page, view, model, key, reason } of reviewedExclusions) {
    if (
      result.page === page &&
      result.view === view &&
      basename(result.model) === model &&
      result.missing.includes(key)
    ) {
      result.missing = result.missing.filter((field) => field !== key);
      result.exclusions.push({ key, reason });
    }
  }
}

// 解析字面量请求路径以及静态服务方法绑定，明确报告无法定位的接口别名。
function resolveOperation(config, scene, services) {
  const pathNode = property(config, scene.path);
  const apiBase = string(property(config, 'apiBase'));
  const serviceNode = property(config, 'apiService');
  const path = pathNode ? string(pathNode) : `${apiBase}/${scene.operation}`;
  const handler = path?.startsWith(`${apiBase}/`)
    ? path.slice(apiBase.length + 1)
    : undefined;

  if (!apiBase || !handler || !/^\w+$/.test(handler)) {
    throw new Error(`${scene.path} 的动态或跨控制器路径无法核对`);
  }
  if (scene.operation === 'list' && property(config, 'listTables')) {
    throw new Error('listTables 使用独立列表接口，需逐一核对');
  }
  if (serviceNode && !pathNode) {
    const service = serviceController(serviceNode, scene.operation);
    const method = getServiceOperation(service, scene.operation);
    if (!method?.path || !/^\w+$/.test(method.path)) {
      throw new Error(`apiService.${scene.operation} 的请求路径无法静态解析`);
    }
    return { service, handler: method.path };
  }

  const candidates = services.get(apiBase) ?? [];
  if (candidates.length !== 1) {
    throw new Error('无法从请求基础路径唯一定位控制器');
  }
  const [service] = candidates;
  return { service, handler, verifyMapping: handler !== scene.operation };
}

// 逐层定位有效控制器方法，识别生成方法签名与明确禁用的接口。
const annotation =
  /@[\w.]+(?:\s*\((?:[^()"']|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\([^()]*\))*\))?\s*/g;

function operationModel(controllers, models, controller, scene, endpoint) {
  const { handler, verifyMapping } = endpoint;
  let path = controllers.get(controller);
  const visited = new Set();
  while (path && !visited.has(path)) {
    visited.add(path);
    const source = javaSource(path);
    const blocks = [...source.matchAll(/@DisableApiOperation\s*\(([^)]*)\)/g)];
    for (const [, rules] of blocks) {
      const disabled = [
        ...rules.matchAll(/"(?:method|path):\/?(\w+)(\*)?"/g),
      ].some(([, name, wildcard]) =>
        wildcard ? handler.startsWith(name) : handler === name,
      );
      if (disabled) return { excluded: `控制器禁用 ${handler}` };
    }
    const declarations = [
      ...source.matchAll(
        new RegExp(
          String.raw`\bpublic\s+ApiResp\s*<([\w.<> ,?\s]+)>\s+${handler}\s*\(`,
          'g',
        ),
      ),
    ];
    if (declarations.length > 0) {
      if (declarations.length > 1) throw new Error(`${handler} 存在多个重载`);
      const [signature, response] = declarations[0];
      if (verifyMapping) {
        const httpVerb = operationVerbs[scene.operation];
        const annotations = source
          .slice(0, declarations[0].index)
          .split(/[{};]/)
          .at(-1);
        const mapping = new RegExp(
          String.raw`@${httpVerb}Mapping\s*\(\s*(?:(?:value|path)\s*=\s*)?"\/?${handler}"`,
        );
        if (!mapping.test(annotations)) {
          throw new Error(
            `无法验证接口别名 ${handler} 的 ${httpVerb.toUpperCase()} 映射`,
          );
        }
      }
      const tail = source.slice(declarations[0].index + signature.length);
      const parameters = tail
        .slice(0, tail.indexOf('{'))
        .replaceAll(annotation, '');
      const type = scene.response
        ? response
            .replaceAll(/\s/g, '')
            .match(
              scene.operation === 'list'
                ? /^(?:[\w.]+\.)?(?:PagingData|List|Collection|CursorPagingData)<([\w.]+)>$/
                : /^([\w.]+)$/,
            )?.[1]
        : parameters.match(/^\s*(?:final\s+)?([\w.]+)\s+\w+\s*[,)]/)?.[1];
      const model = type && javaType(models, source, type);
      if (!model)
        throw new Error(`无法定位 ${handler} 的模型（${basename(path)}）`);
      return { model };
    }
    const parent = javaParent(source);
    path = parent && javaType(controllers, source, parent);
  }
  throw new Error(`无法定位有效 ${handler} 接口（${controller}）`);
}

function flag(object, name) {
  const node = constant(property(object, name));
  if (!node) return undefined;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  throw new Error(`${name} 使用动态表达式`);
}

function eligible(field, view) {
  if (view === 'query') return flag(field, 'search') === true;
  if (view === 'list') return flag(field, 'table') === true;
  const form = flag(field, 'form');
  if (view === 'detail') {
    return (
      flag(field, 'detail') ??
      !(
        flag(field, 'search') &&
        form === false &&
        flag(field, 'table') !== true
      )
    );
  }
  return (
    form !== false &&
    flag(field, view === 'create' ? 'formCreate' : 'formEdit') !== false &&
    flag(field, 'allowInput') !== false &&
    flag(field, 'readOnly') !== true &&
    (view === 'create' || flag(field, 'omitOnEdit') !== true)
  );
}

// 识别按单一字面量键过滤的字段表，保留其余始终存在的字段。
function fieldEntries(list, view, acceptedKeys) {
  const node = constant(list);
  if (
    !ts.isCallExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression) ||
    node.expression.name.text !== 'filter'
  )
    return array(list);

  const [predicate] = node.arguments;
  if (!predicate || !ts.isArrowFunction(predicate)) return array(list);
  const [parameter] = predicate.parameters;
  if (!parameter || !ts.isIdentifier(parameter.name)) return array(list);

  const body = constant(predicate.body);
  const conditional =
    body &&
    ts.isBinaryExpression(body) &&
    body.operatorToken.kind === ts.SyntaxKind.BarBarToken;
  const comparison = conditional ? body.left : body;
  if (
    !comparison ||
    !ts.isBinaryExpression(comparison) ||
    comparison.operatorToken.kind !==
      ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    !ts.isPropertyAccessExpression(comparison.left) ||
    !ts.isIdentifier(comparison.left.expression) ||
    comparison.left.expression.text !== parameter.name.text ||
    comparison.left.name.text !== 'key'
  )
    return array(list);

  const omitted = string(comparison.right);
  const access = node.expression.expression;
  if (!omitted || !ts.isPropertyAccessExpression(access)) return array(list);
  const fields = property(access.expression, access.name.text);
  return [...array(fields)].filter((field) => {
    if (string(property(field, 'key')) !== omitted) return true;
    const alias = view === 'query' && property(field, 'searchParamName');
    if (
      conditional &&
      (acceptedKeys.has(omitted) ||
        (alias && (!string(alias) || acceptedKeys.has(string(alias)))))
    ) {
      throw new Error(`字段 ${omitted} 由页面运行条件过滤`);
    }
    return false;
  });
}

// 只读取指定视图实际消费的字段列表，查询允许显式绑定请求参数别名。
function viewFields(config, view, acceptedKeys) {
  const names =
    view === 'detail'
      ? ['fields', 'detailFields', 'detailExtraFields']
      : ['fields'];
  const fields = new Map();
  const unknown = new Set();
  for (const name of names) {
    const list = property(config, name);
    if (!list) continue;
    for (const field of fieldEntries(list, view, acceptedKeys)) {
      try {
        const key = string(property(field, 'key'));
        if (!key) throw new Error('字段 key 使用动态表达式');
        fields.set(key, field);
      } catch (error) {
        unknown.add(error.message);
      }
    }
  }
  const covered = new Set();
  for (const [key, field] of fields) {
    try {
      if (view === 'query') {
        if (!eligible(field, view)) continue;
        const parameter = property(field, 'searchParamName');
        const binding = parameter && string(parameter);
        if (parameter && !binding)
          throw new Error(`查询字段 ${key} 的参数别名无法解析`);
        covered.add(binding ?? key);
      } else if (
        acceptedKeys.has(key) &&
        eligible(field, view) &&
        (key !== '__tenant' || string(property(field, 'type')) === 'tenant')
      ) {
        covered.add(key);
      }
    } catch (error) {
      unknown.add(error.message);
    }
  }
  return { covered, unsupported: [...unknown] };
}

export function checkScene(config, scene, contract) {
  const expected = new Map();
  const exclusions = [];
  for (const [key, metadata] of contract) {
    const orgListQuery = scene.view === 'query' && key === 'orgIdList';
    if (!ownershipKeys.has(key) && !orgListQuery) continue;
    if (orgListQuery && contract.has('orgId')) continue;
    // 公共多租户请求在更新中仅用 tenantId 匹配旧记录的租户范围。
    if (
      scene.view === 'edit' &&
      key === 'tenantId' &&
      basename(metadata.declaration) === 'MultiTenantReq.java' &&
      !/@Update\b/.test(metadata.annotations)
    ) {
      exclusions.push({
        key,
        reason: 'MultiTenantReq.tenantId 为更新范围条件',
      });
      continue;
    }
    const alternatives = scene.response
      ? displayKeys.get(key).filter((name) => contract.has(name))
      : [];
    if (scene.view === 'list' && key === 'tenantId')
      alternatives.push('__tenant');
    if (scene.view === 'query' && key === 'orgId' && contract.has('orgIdList'))
      alternatives.push('orgIdList');
    expected.set(key, [key, ...alternatives]);
  }

  // 注意列表/详情可只返回关联名称，仍核对相应视图的回显声明。
  if (scene.response) {
    for (const [key, names] of displayKeys) {
      if (expected.has(key)) continue;
      const available = names.filter((name) => contract.has(name));
      if (available.length > 0) expected.set(available[0], available);
    }
  }
  if (expected.size === 0)
    return { fields: [], missing: [], unsupported: [], exclusions };
  const acceptedKeys = new Set([...expected.values()].flat());
  const { covered, unsupported } = viewFields(config, scene.view, acceptedKeys);
  const fields = [...expected.keys()];
  const unverified = fields.filter(
    (key) => !expected.get(key).some((name) => covered.has(name)),
  );
  return {
    fields,
    missing: unsupported.length > 0 ? [] : unverified,
    unsupported,
    exclusions,
  };
}

// 核对 Vue 内嵌入口直接绑定的对象，以及 computed 中返回的静态对象。
function vueConfigs(path, content, registered) {
  const bindings = [
    ...content.matchAll(
      /<(?:Dynamic)?CrudPage\b[^>]*?\s:config=["']([\w$]+)["']/g,
    ),
  ].map((match) => match[1]);
  if (bindings.length === 0) return [undefined];

  const script = /<script\b[^>]*>([\s\S]*?)<\/script>/.exec(content);
  const padding = content.slice(0, script?.index ?? 0).replaceAll(/[^\n]/g, '');
  const file = ts.createSourceFile(
    path,
    padding + (script?.[1] ?? ''),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const localBindings = new Map();
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const item of statement.declarationList.declarations) {
        if (ts.isIdentifier(item.name))
          localBindings.set(item.name.text, item.name);
      }
    }
    if (ts.isImportDeclaration(statement)) {
      const named = statement.importClause?.namedBindings;
      if (named && ts.isNamedImports(named)) {
        for (const item of named.elements)
          localBindings.set(item.name.text, item.name);
      }
    }
  }

  const configs = [];
  for (const name of new Set(bindings)) {
    let config = constant(localBindings.get(name));
    if (
      config &&
      ts.isCallExpression(config) &&
      ts.isIdentifier(config.expression) &&
      config.expression.text === 'computed'
    ) {
      const getter = config.arguments[0];
      config =
        getter && ts.isArrowFunction(getter)
          ? constant(getter.body)
          : undefined;
    }
    if (!config || !ts.isObjectLiteralExpression(config)) {
      if (!registered) configs.push(undefined);
      continue;
    }
    if (
      config.getSourceFile().fileName === resolve(dirname(path), 'config.ts') &&
      registered
    )
      continue;
    configs.push(config);
  }
  return configs;
}

export function check({
  frontend = frontendRoot,
  backend = backendRoot,
  views = resolve(
    frontend,
    'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views',
  ),
  api = resolve(views, '../api'),
  controllerRoot = resolve(backend, 'admin-api/src/main/java'),
  serviceRoot = resolve(backend, 'services/src/main/java'),
} = {}) {
  const controllers = javaIndex(controllerRoot, (path) =>
    path.endsWith('.java'),
  );
  const models = new Map([
    ...controllers,
    ...javaIndex(serviceRoot, (path) => path.endsWith('.java')),
  ]);
  const services = new Map();

  // 查询路径与页面目录按源码索引，供缺少服务实例的标准页面使用。
  if (existsSync(api)) {
    for (const path of files(api)) {
      if (!path.endsWith('-service.ts')) continue;
      for (const statement of parseModule(path).statements) {
        if (!ts.isClassDeclaration(statement)) continue;
        const service = serviceMetadata(statement);
        if (!service?.basePath) continue;
        const matches = services.get(service.basePath) ?? [];
        matches.push(service);
        services.set(service.basePath, matches);
      }
    }
  }
  const results = [];
  // 共享组件的使用方已有独立入口配置，避免把同一组件误计为业务页面。
  const sharedShells = new Set([
    'crud-page.vue',
    'partner/partner-crud-page.vue',
    'setting-crud-page.vue',
    'simple-content-resource-page.vue',
  ]);
  const candidates = [...files(views)]
    .filter(
      (file) =>
        (basename(file) === 'config.ts' || file.endsWith('.vue')) &&
        !sharedShells.has(relative(views, file)),
    )
    .toSorted();
  const registered = new Set();

  for (const path of candidates) {
    const directory = dirname(path);
    const vue = path.endsWith('.vue');
    let configs;
    if (vue) {
      const content = readFileSync(path, 'utf8');
      if (!/<(?:Dynamic)?CrudPage\b/.test(content)) continue;
      configs = vueConfigs(path, content, registered.has(directory));
    } else {
      configs = pageConfigs(parseModule(path));
      if (configs.length > 0) registered.add(directory);
    }

    for (const config of configs) {
      for (const scene of scenes) {
        const result = {
          page: relative(views, directory),
          file: relative(frontend, config?.getSourceFile().fileName ?? path),
          line: config
            ? config
                .getSourceFile()
                .getLineAndCharacterOfPosition(config.getStart()).line + 1
            : 1,
          view: scene.view,
          operation: scene.operation,
          fields: [],
          missing: [],
          unsupported: [],
        };
        results.push(result);
        try {
          if (!config) throw new Error('缺少可静态解析的标准 CRUD 配置');
          const enable = constant(property(config, scene.disabled));
          if (enable?.kind === ts.SyntaxKind.FalseKeyword) {
            result.excluded = `页面显式禁用 ${scene.operation}`;
            continue;
          }
          if (enable && enable.kind !== ts.SyntaxKind.TrueKeyword) {
            result.conditional = `${scene.disabled} 由页面运行条件控制`;
          }
          const endpoint = resolveOperation(config, scene, services);
          result.handler = endpoint.handler;
          const outcome = operationModel(
            controllers,
            models,
            endpoint.service.path,
            scene,
            endpoint,
          );
          if (outcome.excluded) {
            result.excluded = outcome.excluded;
            continue;
          }
          result.model = relative(backend, outcome.model);
          const contract = responseFields(
            models,
            outcome.model,
            new Set(),
            scene.response ? 'response' : 'request',
          );
          Object.assign(result, checkScene(config, scene, contract));
          applyReviewedExclusions(result);
          if (result.conditional && result.missing.length > 0) {
            result.unsupported.push(result.conditional);
            result.missing = [];
          }
        } catch (error) {
          result.unsupported.push(error.message);
        }
      }
    }
  }
  if (results.length === 0) throw new Error('未发现待检查的标准 CRUD 配置');
  return results;
}

// 明确漏配阻断开发检查，动态契约单独报告。
function main() {
  const results = check();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    for (const {
      file,
      line,
      model,
      view,
      operation,
      missing,
      unsupported,
    } of results) {
      const location = `${file}:${line} [${view}/${operation}]`;
      for (const key of missing) {
        process.stderr.write(
          `${location} 缺少归属字段 ${key}（${basename(model)}）\n`,
        );
      }
      for (const reason of unsupported) {
        process.stderr.write(`${location} 无法验证（${reason}）\n`);
      }
    }
    const missing = results.reduce(
      (total, result) => total + result.missing.length,
      0,
    );
    const unsupported = results.filter(
      (result) => result.unsupported.length,
    ).length;
    process.stdout.write(
      `CRUD 租户与组织字段核对完成，${results.length} 项，${missing} 个字段漏配，${unsupported} 项需人工核对\n`,
    );
  }
  if (results.some((result) => result.missing.length)) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
