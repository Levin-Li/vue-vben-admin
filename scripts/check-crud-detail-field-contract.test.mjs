import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { check } from './check-crud-detail-field-contract.mjs';

const { test } = process.env.VITEST
  ? await import('vitest')
  : await import('node:test');

test('按实际 retrieve 返回类型核对继承字段、标题与显式排除', () => {
  const root = mkdtempSync(join(tmpdir(), 'crud-detail-contract-'));
  const viewsRoot = join(root, 'views');
  const controllerRoot = join(root, 'controller');
  const serviceRoot = join(root, 'services');
  const apiRoot = join(root, 'api');

  // 构造真实目录形状，覆盖业务控制器继承、响应继承及未标注属性。
  function write(path, text) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  try {
    write(
      join(controllerRoot, 'fixture/BizController.java'),
      'package fixture; public class BizController extends BaseController {}',
    );
    write(
      join(controllerRoot, 'fixture/BaseController.java'),
      `package fixture;
       import fixture.info.ActualInfo;
       public class BaseController {
         public ApiResp<ActualInfo> retrieve(Id id) { return null; }
       }`,
    );
    write(
      join(serviceRoot, 'fixture/info/BaseInfo.java'),
      `package fixture.info;
       public class BaseInfo {
         @Schema(title = "租户名称")
         String tenantName;
       }`,
    );
    write(
      join(serviceRoot, 'fixture/info/ActualInfo.java'),
      `package fixture.info;
       public class ActualInfo extends BaseInfo {
         static final int VERSION = 1;
         @JsonIgnore(true) @Schema(title = "密钥") String secret;
         @Schema(title = "中文、字段") String covered;
         @Schema(title = "需要更正") String invalidTitle;
         @Schema(title = "新增字段") String newField;
         String unannotated;
       }`,
    );
    write(
      join(apiRoot, 'example-service.ts'),
      `@Service({ basePath: '/DifferentResource', controllerClass: 'fixture.BizController' })
       class ExampleService {
         retrieve() { return this.get('retrieve'); }
       }
       export const exampleService = new ExampleService();`,
    );
    write(
      join(viewsRoot, 'shared.ts'),
      'export const audit = [{ key: "tenantName", detail: false }] as const;',
    );
    write(
      join(viewsRoot, 'fixture/config.ts'),
      `import { audit } from '../shared';
       import { exampleService } from '../../api/example-service';
       export const config = {
         apiBase: '/DifferentResource',
         apiService: exampleService,
         fields: [
           ...audit,
           { key: 'covered', label: 'covered' },
           { key: 'invalidTitle', label: 'invalidTitle' },
         ],
         detailExtraFields: [{ key: 'covered', label: '正确标题' }],
       };`,
    );
    write(
      join(viewsRoot, 'unsupported/index.vue'),
      '<template><DynamicCrudPage :config="makeConfig()" /></template>',
    );
    write(
      join(viewsRoot, 'fallback/config.ts'),
      `export const config = {
         apiBase: '/DifferentResource',
         fields: [
           { key: 'tenantName', detail: false },
           { key: 'covered', label: '已声明字段' },
           { key: 'invalidTitle', detail: false },
           { key: 'newField', detail: false },
           { key: 'unannotated', detail: false },
         ],
       };`,
    );
    write(
      join(viewsRoot, 'override/config.ts'),
      `import { exampleService } from '../../api/example-service';
       export const config = {
         apiBase: '/DifferentResource',
         apiService: exampleService,
         detailPath: '/Other/retrieve',
       };`,
    );
    const [fallback, page, override, unsupported] = check({
      frontendRoot: root,
      backendRoot: root,
      viewsRoot,
      controllerRoot,
      serviceRoot,
      apiRoot,
    });

    // 校验诊断含源码归属和注解语义，动态页面必须给出失败原因。
    assert.equal(page.model, 'services/fixture/info/ActualInfo.java');
    assert.equal(page.unsupported, undefined);
    assert.deepEqual(page.issues, [
      { key: 'invalidTitle', title: '需要更正', type: '缺少静态中文标题' },
      { key: 'newField', title: '新增字段', type: '未声明详情字段' },
      { key: 'unannotated', title: undefined, type: '未声明详情字段' },
    ]);
    assert.equal(fallback.model, page.model);
    assert.deepEqual(fallback.issues, []);
    assert.equal(fallback.unsupported, undefined);
    assert.match(override.unsupported, /GET retrieve/);
    assert.match(unsupported.unsupported, /config\.ts/);
    assert.equal(unsupported.boundary, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
