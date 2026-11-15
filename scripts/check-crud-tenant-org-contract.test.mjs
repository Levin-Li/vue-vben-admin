import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
// 独立开发门禁的测试可直接用 Node.js 执行。
// eslint-disable-next-line test/no-import-node-test
import { test } from 'node:test';

import ts from 'typescript';

import { check, checkScene } from './check-crud-tenant-org-contract.mjs';

// 使用真实控制器继承和页面静态配置验证五个接口视图。
function fixture(t, fields, embedded = false) {
  const root = mkdtempSync(join(tmpdir(), 'crud-tenant-org-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const frontend = join(root, 'admin');
  const views = join(frontend, 'views');
  const api = join(frontend, 'api');
  const controllers = join(root, 'controllers');
  const services = join(root, 'services');
  const write = (path, body) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  };
  write(
    join(controllers, 'example', 'ResourceController.java'),
    `
    package example;
    import models.*;
    public class ResourceController {
      public ApiResp<PagingData<RowInfo>> list(@Valid final FindReq filter, SimplePaging paging) {}
      public ApiResp<String> create(@Valid @RequestBody AddReq req) {}
      @PostMapping("save")
      public ApiResp<String> save(@Valid @RequestBody AddReq req) {}
      public ApiResp<Void> update(@Valid @RequestBody EditReq req) {}
      public ApiResp<ViewInfo> retrieve(@Valid IdReq req) {}
    }
  `,
  );
  write(
    join(controllers, 'example', 'BizResourceController.java'),
    `
    package example;
    import models.OverrideEditReq;
    public class BizResourceController extends ResourceController {
      public ApiResp<Void> update(@Valid @RequestBody OverrideEditReq req) {}
    }
  `,
  );
  for (const [name, body] of [
    [
      'FindReq extends BaseQueryReq<FindReq>',
      'protected String orgType; String orgCategory;',
    ],
    ['BaseQueryReq<T extends BaseQueryReq<T>> extends ScopeReq', ''],
    ['ScopeReq', 'protected String tenantId; protected String orgId;'],
    [
      'RowInfo',
      'String tenantId; String tenantName; String orgId; String orgName;',
    ],
    ['ViewInfo', 'String tenantId; @JsonIgnore String orgId;'],
    [
      'AddReq',
      'String tenantId; String orgId; @JsonProperty(access = Access.READ_ONLY) String sourceOrgId; @InjectVar(isOverride = "true") String targetOrgId;',
    ],
    ['EditReq', 'String tenantId;'],
    ['OverrideEditReq', 'String orgId;'],
  ]) {
    write(
      join(services, 'models', `${name.split(/[ <]/)[0]}.java`),
      `package models; public class ${name} { ${body} }`,
    );
  }
  write(
    join(api, 'resource-service.ts'),
    `
    @Service({ basePath: '/Resource', controllerClass: 'example.BizResourceController' })
    class ResourceService {
      list() { return this.get('list'); }
      save() { return this.post('save'); }
      create() { return this.post('create'); }
      update() { return this.put('update'); }
      retrieve() { return this.get('retrieve'); }
    }
    export const service = new ResourceService();
  `,
  );
  write(
    join(views, 'resource', 'config.ts'),
    `
    import { service as apiService } from '../../api/resource-service';
    export const config = { apiBase: '/Resource', apiService, ${fields} };
  `,
  );
  write(
    join(views, 'crud-page.vue'),
    '<template><DynamicCrudPage :config="props.config" /></template>',
  );
  if (embedded) {
    write(
      join(views, 'resource', 'embedded.vue'),
      `
      <script lang="ts" setup>
        import { config as base } from './config';
        const pane = computed(() => ({
          ...base,
          allowEdit: false,
          createPath: '/Resource/save',
          fields: [
            ...baseFields,
            { key: 'orgId', formCreate: true },
            { key: 'tenantId', formCreate: true },
          ],
        }));
        const baseFields = [];
      </script>
      <template><CrudPage :config="pane" /></template>
      `,
    );
  }
  return check({
    frontend,
    backend: root,
    views,
    api,
    controllerRoot: controllers,
    serviceRoot: services,
  });
}

test('继承请求、业务控制器覆写、查询别名和列表名称回显使用各自契约', (t) => {
  const results = fixture(
    t,
    `
    fields: [
      { key: 'tenantFilter', search: true, searchParamName: 'tenantId', form: false },
      { key: 'tenantName', table: true, form: false },
      { key: 'orgName', table: true, form: false },
      { key: 'tenantId', formEdit: false },
      { key: 'orgId', type: 'org-tree-select', search: true, detail: false },
    ],
  `,
  );
  assert.deepEqual(
    results.map(({ view, fields, missing, unsupported }) => [
      view,
      fields,
      missing,
      unsupported,
    ]),
    [
      ['query', ['tenantId', 'orgId'], [], []],
      ['list', ['tenantId', 'orgId'], [], []],
      ['create', ['tenantId', 'orgId'], [], []],
      ['edit', ['orgId'], [], []],
      ['detail', ['tenantId'], [], []],
    ],
  );
  assert.match(results[3].model, /OverrideEditReq\.java$/);
});

test('各视图独立报告漏配，组织匹配条件无法抵消组织归属缺失', (t) => {
  const results = fixture(
    t,
    `
    fields: [
      { key: 'tenantId', search: true, form: false, detail: false },
      { key: 'orgType', search: true, table: true },
      { key: 'orgCategory', search: true, table: true },
      { key: '__tenant', table: true, form: false },
    ],
  `,
  );
  assert.deepEqual(
    results.map(({ view, missing }) => [view, missing]),
    [
      ['query', ['orgId']],
      ['list', ['tenantId', 'orgId']],
      ['create', ['tenantId', 'orgId']],
      ['edit', ['orgId']],
      ['detail', ['tenantId']],
    ],
  );
});

test('内嵌 Vue 的 computed 静态配置识别请求别名、字段展开及禁用编辑', (t) => {
  const results = fixture(t, 'fields: []', true).filter(({ file }) =>
    file.endsWith('embedded.vue'),
  );
  const create = results.find(({ view }) => view === 'create');
  assert.equal(create.handler, 'save');
  assert.deepEqual(create.fields, ['tenantId', 'orgId']);
  assert.deepEqual(create.missing, []);
  assert.deepEqual(create.unsupported, []);
  assert.equal(
    results.find(({ view }) => view === 'edit').excluded,
    '页面显式禁用 update',
  );
});

function config(source) {
  const file = ts.createSourceFile(
    'fixture.ts',
    `const config = ${source};`,
    ts.ScriptTarget.Latest,
    true,
  );
  return file.statements[0].declarationList.declarations[0].initializer;
}

test('动态条件摊开与无法解析的请求参数别名需要人工核对', () => {
  for (const expression of [
    '{ fields: [{ key: "name", search: true }, ...buildFields()] }',
    '{ fields: [{ key: "tenant", search: true, searchParamName: getParam() }] }',
  ]) {
    const result = checkScene(
      config(expression),
      { view: 'query' },
      new Map([['tenantId', {}]]),
    );
    assert.deepEqual(result.missing, []);
    assert.equal(result.unsupported.length, 1);
  }
});

test('只有真实租户列使用租户回显，编辑范围条件保留不适用依据', () => {
  const result = checkScene(
    config('{ fields: [{ key: "__tenant", table: true, type: "tenant" }] }'),
    { view: 'list', response: true },
    new Map([['tenantId', '归属租户']]),
  );
  assert.deepEqual(result.missing, []);
  const edit = checkScene(
    config('{ fields: [] }'),
    { view: 'edit' },
    new Map([
      [
        'orgId',
        { declaration: 'MultiTenantOrgReq.java', annotations: '@Update' },
      ],
      ['tenantId', { declaration: 'MultiTenantReq.java', annotations: '@Eq' }],
    ]),
  );
  assert.deepEqual(edit.missing, ['orgId']);
  assert.deepEqual(edit.exclusions, [
    { key: 'tenantId', reason: 'MultiTenantReq.tenantId 为更新范围条件' },
  ]);
});

test('组织列表查询需有真实后端参数才可覆盖组织归属条件', () => {
  const scope = config('{ fields: [{ key: "orgIdList", search: true }] }');
  const scene = { view: 'query' };
  assert.deepEqual(checkScene(scope, scene, new Map([['orgId', {}]])).missing, [
    'orgId',
  ]);
  assert.deepEqual(
    checkScene(
      scope,
      scene,
      new Map([
        ['orgId', {}],
        ['orgIdList', {}],
      ]),
    ).missing,
    [],
  );
  assert.deepEqual(
    checkScene(scope, scene, new Map([['orgIdList', {}]])).missing,
    [],
  );
});

test('按字面量键过滤 Webhook 时仍可核对租户和组织配置', () => {
  const file = ts.createSourceFile(
    'fixture.ts',
    `const base = { fields: [
      { key: 'webhookUrl', form: true },
      { key: 'tenantId', search: true },
      { key: 'orgId', search: true },
    ] };
    const page = {
      ...base,
      fields: base.fields.filter((field) => field.key !== 'webhookUrl' || allowed.value),
    };
    const conditional = {
      ...base,
      fields: base.fields.filter((field) => field.key !== 'orgId' || allowed.value),
    };`,
    ts.ScriptTarget.Latest,
    true,
  );
  const scene = { view: 'query' };
  const contract = new Map([
    ['orgId', {}],
    ['tenantId', {}],
  ]);
  const page = file.statements[1].declarationList.declarations[0].initializer;
  const conditional =
    file.statements[2].declarationList.declarations[0].initializer;
  assert.deepEqual(checkScene(page, scene, contract).missing, []);
  assert.throws(
    () => checkScene(conditional, scene, contract),
    /字段 orgId 由页面运行条件过滤/,
  );
});
