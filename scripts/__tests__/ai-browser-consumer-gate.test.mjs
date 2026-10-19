import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { it } from 'vitest';

import {
  browserHarnessSource,
  mockViteConfig,
  prepareConsumer,
  verifyBrowserRuntime,
} from '../ai-browser-consumer-gate.mjs';

const manifest = {
  name: '@levin/oak-base-admin',
  version: '1.0.0',
  exports: {
    './ai-sdk-browser': {
      types: './dist/ai-sdk-browser.d.mts',
      default: './dist/ai-sdk-browser.mjs',
    },
  },
  peerDependencies: { vue: '>=3.5.0' },
};

// 用真实压缩包验证安装输入，避免工作区源码或软链接掩盖导出问题。
function fixture(
  directory,
  packageManifest = manifest,
  source = 'export const generateText = () => {};',
) {
  const staging = join(directory, 'staging');
  mkdirSync(join(staging, 'package/dist'), { recursive: true });
  writeFileSync(
    join(staging, 'package/package.json'),
    JSON.stringify(packageManifest),
  );
  writeFileSync(join(staging, 'package/dist/ai-sdk-browser.mjs'), source);
  const tarball = join(directory, 'oak.tgz');
  execFileSync('tar', ['-czf', tarball, '-C', staging, 'package']);
  return tarball;
}

it('拒绝 development 条件、裸导入和 Node 运行时依赖', () => {
  assert.doesNotThrow(() =>
    verifyBrowserRuntime(
      manifest,
      `// import value from './comment.js';\nexport const value = 1;`,
    ),
  );
  assert.throws(
    () =>
      verifyBrowserRuntime(
        {
          ...manifest,
          exports: {
            './ai-sdk-browser': {
              development: './src/runtime.ts',
              default: './dist/ai-sdk-browser.mjs',
            },
          },
        },
        '',
      ),
    /dist/,
  );
  for (const source of [
    "import { generateText } from 'ai';",
    "export { get } from 'node:fs';",
    "const sdk = import('@vercel/oidc');",
    "require('crypto')",
    "import './chunk.mjs';",
  ]) {
    assert.throws(() => verifyBrowserRuntime(manifest, source));
  }
});

it('从真实 tarball 创建无别名和预打包补丁的独立消费者并锁定同批依赖', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ai-consumer-test-'));
  try {
    const tarball = fixture(directory);
    const consumer = prepareConsumer([tarball], join(directory, 'consumer'));
    const installedManifest = JSON.parse(
      readFileSync(join(consumer, 'package.json'), 'utf8'),
    );
    assert.equal(
      installedManifest.dependencies['@levin/oak-base-admin'],
      'file:./0.tgz',
    );
    assert.equal(
      installedManifest.pnpm.overrides['@levin/oak-base-admin'],
      'file:./0.tgz',
    );
    assert.deepEqual(
      readFileSync(join(consumer, '0.tgz')),
      readFileSync(tarball),
    );
    assert.equal(installedManifest.devDependencies.vite, '7.3.1');
    const main = readFileSync(join(consumer, 'main.js'), 'utf8');
    assert.match(
      main,
      /await import\('@levin\/oak-base-admin\/ai-sdk-browser'\)/,
    );
    assert.doesNotMatch(main, /from ['"](?:ai|@ai-sdk|@vercel)/);
    assert.match(main, /mock-model/);
    assert.match(main, /return fetch\(url/);
    assert.doesNotMatch(mockViteConfig(), /alias|optimizeDeps|polyfill/);
    assert.match(main, /maxRetries: 0/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('拒绝缺少 Oak 或重复 tarball，页面保留运行异常证据', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ai-consumer-test-'));
  try {
    assert.throws(
      () => prepareConsumer([], join(directory, 'missing')),
      /oak-base-admin/,
    );
    const tarball = fixture(directory);
    assert.throws(
      () => prepareConsumer([tarball, tarball], join(directory, 'duplicate')),
      /重复/,
    );
    assert.match(browserHarnessSource(), /unhandledrejection/);
    assert.match(browserHarnessSource(), /status: 'ready'/);
    // 运行测试页面初始化，验证跨源 fetch 被记录并阻止，且不记录凭据或请求正文。
    let actualRequests = 0;
    const window = {
      fetch: async () => {
        actualRequests++;
        return new Response('{}');
      },
      addEventListener() {},
    };
    const document = {
      querySelector: () => ({ textContent: '', addEventListener() {} }),
    };
    const location = {
      origin: 'http://127.0.0.1:5797',
      href: 'http://127.0.0.1:5797/',
    };
    runInNewContext(browserHarnessSource(), {
      window,
      document,
      location,
      URL,
      Request,
    });
    await window.fetch('/mock-model/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'test-secret' },
      body: 'private-body',
    });
    await assert.rejects(
      window.fetch('https://gateway.invalid/v1', { method: 'POST' }),
      /意外跨源请求/,
    );
    assert.equal(actualRequests, 1);
    assert.equal(window.__aiBrowserGate.status, 'failed');
    assert.deepEqual(structuredClone(window.__aiBrowserGate.allFetch), [
      {
        url: 'http://127.0.0.1:5797/mock-model/v1/chat/completions',
        method: 'POST',
      },
      { url: 'https://gateway.invalid/v1', method: 'POST' },
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('协议模拟器同时提供开发态与预览入口，并拒绝无效协议请求', async () => {
  const { default: config } = await import(
    `data:text/javascript,${encodeURIComponent(mockViteConfig())}`
  );
  const plugin = config.plugins[0];
  assert.equal(plugin.configureServer, plugin.configurePreviewServer);
  let handler;
  plugin.configureServer({
    middlewares: {
      use(path, middleware) {
        assert.equal(path, '/mock-model/v1/chat/completions');
        handler = middleware;
      },
    },
  });
  const call = async (method, headers, body) => {
    let result;
    const response = {
      statusCode: 200,
      setHeader() {},
      end(text) {
        result = JSON.parse(text);
      },
    };
    const request = {
      method,
      headers,
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify(body);
      },
    };
    await handler(request, response);
    return { status: response.statusCode, result };
  };
  const reply = await call(
    'POST',
    { authorization: 'Bearer consumer-test-token' },
    {
      model: 'consumer-test-model',
      messages: [{ role: 'user', content: '测试' }],
    },
  );
  assert.equal(reply.status, 200);
  assert.equal(reply.result.choices[0].message.content, '浏览器 SDK 验收通过');
  const badMethod = await call('GET', {}, {});
  assert.equal(badMethod.status, 400);
  const badModel = await call(
    'POST',
    { authorization: 'Bearer consumer-test-token' },
    { model: 'bad', messages: [] },
  );
  assert.equal(badModel.status, 400);
});
