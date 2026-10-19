import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const packageName = '@levin/oak-base-admin';
const runtimeEntry = './ai-sdk-browser';
const expectedFile = './dist/ai-sdk-browser.mjs';

// 浏览器专用入口必须自包含；禁止把条件导出、Node 依赖和裸包解析转嫁给消费者。
export function verifyBrowserRuntime(manifest, source) {
  const entry = manifest.exports?.[runtimeEntry];
  const targets =
    typeof entry === 'string' ? [entry] : Object.values(entry || {});
  if (
    manifest.name !== packageName ||
    !targets.includes(expectedFile) ||
    (typeof entry === 'object' && Object.hasOwn(entry, 'development')) ||
    targets.some((target) => !target.startsWith('./dist/'))
  ) {
    throw new Error('AI 浏览器公开入口必须在所有条件下指向 dist 构件');
  }

  // 使用已声明的 TypeScript 解析器识别真正的导入，避免注释和不可达分支中的文本误报。
  const parsed = ts.createSourceFile(
    'ai-sdk-browser.mjs',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const imports = [];
  let hasRequire = false;
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        imports.push(
          ts.isStringLiteral(node.arguments[0])
            ? node.arguments[0].text
            : '<动态模块>',
        );
      }
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require'
      )
        hasRequire = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  if (parsed.parseDiagnostics.length > 0)
    throw new Error('AI 浏览器构件存在 JavaScript 语法错误');
  if (imports.length > 0) {
    throw new Error(
      `AI 浏览器构件必须自包含，残留模块导入：${imports.join(', ')}`,
    );
  }
  if (hasRequire) throw new Error('AI 浏览器构件残留 CommonJS require 调用');
}

// 测试页面在点击前不导入 SDK；固定协议响应只验证真实 SDK 执行路径，不连接供应商。
export function browserHarnessSource() {
  return `
const result = window.__aiBrowserGate = { status: 'ready', requests: [], allFetch: [], errors: [], nodeGlobals: { process: typeof process, Buffer: typeof Buffer } };
const output = document.querySelector('#result');
const render = () => { output.textContent = JSON.stringify(result, null, 2); };
// 仅测试页面记录 URL 与方法；跨源请求在发送前失败，保留原生 fetch 完成同源 HTTP。
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href);
  const method = init?.method || (input instanceof Request ? input.method : 'GET');
  result.allFetch.push({ url: url.href, method });
  if (url.origin !== location.origin) {
    const error = new Error('独立消费者发现意外跨源请求：' + url.origin);
    result.errors.push(error.message); result.status = 'failed'; render();
    throw error;
  }
  render();
  return nativeFetch(input, init);
};
window.addEventListener('error', (event) => { result.errors.push(event.message); render(); });
window.addEventListener('unhandledrejection', (event) => { result.errors.push(String(event.reason)); render(); });
document.querySelector('#run').addEventListener('click', async () => {
  result.status = 'running'; render();
  try {
    result.sdkResourcesBeforeCall = performance.getEntriesByType('resource').map((item) => item.name).filter((name) => /ai-sdk-browser|@vercel|oidc|@ai-sdk/.test(name));
    if (result.sdkResourcesBeforeCall.length > 0 || result.nodeGlobals.process !== 'undefined' || result.nodeGlobals.Buffer !== 'undefined') throw new Error('冷启动提前加载了 SDK 或依赖了 Node 全局');
    const { createOpenAICompatible, generateText, wrapLanguageModel } = await import('@levin/oak-base-admin/ai-sdk-browser');
    if ([createOpenAICompatible, generateText, wrapLanguageModel].some((value) => typeof value !== 'function')) throw new Error('公开导出缺失');
    const provider = createOpenAICompatible({
      name: 'browser-consumer-gate', apiKey: 'consumer-test-token', baseURL: location.origin + '/mock-model/v1',
      fetch: async (url, init) => {
        const body = JSON.parse(String(init.body));
        result.requests.push({ url: String(url), model: body.model, messages: body.messages.length });
        if (String(url) !== location.origin + '/mock-model/v1/chat/completions' || body.model !== 'consumer-test-model') throw new Error('请求协议不正确');
        if (new Headers(init.headers).get('authorization') !== 'Bearer consumer-test-token') throw new Error('测试鉴权不正确');
        return fetch(url, { ...init, credentials: 'omit' });
      },
    });
    const model = wrapLanguageModel({ model: provider.chatModel('consumer-test-model'), middleware: {} });
    const reply = await generateText({ model, prompt: '测试公开浏览器入口', maxRetries: 0, experimental_telemetry: { isEnabled: false } });
    if (reply.text !== '浏览器 SDK 验收通过') throw new Error('SDK 返回值不正确');
    if (result.errors.length > 0) throw new Error('验收期间存在异常网络请求或页面错误');
    result.text = reply.text; result.status = 'passed';
  } catch (error) { result.status = 'failed'; result.errors.push(String(error)); }
  render();
});
render();
`;
}

// 协议模拟器只绑定 Vite 本机服务；开发态与生产预览共用同一个真实 HTTP 响应。
export function mockViteConfig() {
  return `
function installMock(server) {
  server.middlewares.use('/mock-model/v1/chat/completions', async (request, response) => {
    response.setHeader('content-type', 'application/json');
    try {
      if (request.method !== 'POST' || request.headers.authorization !== 'Bearer consumer-test-token') throw new Error('测试请求方法或鉴权不正确');
      let raw = '';
      for await (const chunk of request) {
        raw += chunk;
        if (raw.length > 16384) throw new Error('测试请求体超限');
      }
      const body = JSON.parse(raw);
      if (body.model !== 'consumer-test-model' || !Array.isArray(body.messages) || !body.messages.some((item) => item.role === 'user')) throw new Error('测试请求协议不正确');
      response.end(JSON.stringify({ id: 'browser-consumer-test', object: 'chat.completion', created: 1,
        model: 'consumer-test-model', choices: [{ index: 0, message: { role: 'assistant', content: '浏览器 SDK 验收通过' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
    } catch (error) { response.statusCode = 400; response.end(JSON.stringify({ error: { message: error.message } })); }
  });
}
export default { plugins: [{ name: 'ai-http-protocol-mock', configureServer: installMock, configurePreviewServer: installMock }] };
`;
}

// 保持与既有独立消费者门禁一致：复制同字节 tarball，以 overrides 覆盖本批间接依赖。
export function prepareConsumer(tarballs, directory) {
  const consumer = directory
    ? resolve(directory)
    : mkdtempSync(join(tmpdir(), 'levin-ai-browser-'));
  if (directory && existsSync(consumer) && readdirSync(consumer).length > 0) {
    throw new Error('独立消费者必须使用全新或空目录');
  }
  mkdirSync(consumer, { recursive: true });
  // 独立目录不继承工作区 .npmrc，内部包仍从既有私服解析；不复制或输出认证信息。
  writeFileSync(
    join(consumer, '.npmrc'),
    [
      `registry=${process.env.NPM_CONFIG_FALLBACK_REGISTRY || 'https://registry.npmmirror.com'}`,
      ...['@levin', '@vben', '@vben-core'].map(
        (scope) =>
          `${scope}:registry=${process.env.NPM_CONFIG_REGISTRY || 'http://nexus.v-ma.com/repository/npm/'}`,
      ),
      'strict-peer-dependencies=false',
      '',
    ].join('\n'),
  );
  const dependencies = {};
  let oakManifest;
  for (const [index, tarball] of tarballs.entries()) {
    const absolute = resolve(tarball);
    const readEntry = (file) =>
      execFileSync('tar', ['-xOf', absolute, `package/${file}`], {
        encoding: 'utf8',
      });
    const manifest = JSON.parse(readEntry('package.json'));
    if (dependencies[manifest.name])
      throw new Error(`重复的待验收包：${manifest.name}`);
    if (manifest.name === packageName) {
      oakManifest = manifest;
      verifyBrowserRuntime(manifest, readEntry(expectedFile.slice(2)));
    }
    const local = join(consumer, `${index}.tgz`);
    copyFileSync(absolute, local);
    const hash = (path) =>
      createHash('sha256').update(readFileSync(path)).digest('hex');
    if (hash(absolute) !== hash(local))
      throw new Error('消费者 tarball 字节校验失败');
    dependencies[manifest.name] = `file:./${index}.tgz`;
  }
  if (!oakManifest) throw new Error('必须提供 oak-base-admin 的真实 tarball');
  const manifest = {
    name: 'levin-ai-browser-consumer',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite --host 127.0.0.1',
      build: 'vite build',
      preview: 'vite preview --host 127.0.0.1',
    },
    dependencies: { ...oakManifest.peerDependencies, ...dependencies },
    devDependencies: { vite: '7.3.1' },
    pnpm: { overrides: dependencies },
  };
  writeFileSync(
    join(consumer, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeFileSync(
    join(consumer, 'index.html'),
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>AI 浏览器独立消费者验收</title><h1>AI 浏览器独立消费者验收</h1><button id="run">执行真实 SDK</button><pre id="result"></pre><script type="module" src="/main.js"></script></html>\n',
  );
  writeFileSync(join(consumer, 'main.js'), browserHarnessSource());
  writeFileSync(join(consumer, 'vite.config.mjs'), mockViteConfig());
  return consumer;
}

// 启动脚本保留构件、锁文件和日志目录；不发布包，不注入 Vite 兼容补丁。
async function main(args) {
  const tarballs = [];
  let directory;
  let serve = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--tarball' && args[index + 1])
      tarballs.push(args[++index]);
    else if (args[index] === '--directory' && args[index + 1])
      directory = args[++index];
    else if (args[index] === '--serve') serve = true;
    else
      throw new Error(
        '用法：node scripts/ai-browser-consumer-gate.mjs --tarball <oak.tgz> [--tarball <本批依赖.tgz>] [--directory <新目录>] [--serve]',
      );
  }
  const consumer = prepareConsumer(tarballs, directory);
  console.log(`独立消费者目录：${consumer}`);
  for (const command of [
    ['install', '--ignore-scripts', '--no-frozen-lockfile'],
    ['run', 'build'],
  ]) {
    execFileSync('pnpm', command, { cwd: consumer, stdio: 'inherit' });
  }
  console.log(
    '静态构件及默认 Vite 生产构建通过；浏览器冷启动、刷新和按钮验收尚待执行。',
  );
  console.log(
    `启动开发态：pnpm --dir ${consumer} dev --port 5797 --strictPort`,
  );
  console.log(
    `启动生产预览：pnpm --dir ${consumer} preview --port 5798 --strictPort`,
  );
  if (!serve) return;
  const children = [
    spawn('pnpm', ['dev', '--port', '5797', '--strictPort'], {
      cwd: consumer,
      stdio: 'inherit',
    }),
    spawn('pnpm', ['preview', '--port', '5798', '--strictPort'], {
      cwd: consumer,
      stdio: 'inherit',
    }),
  ];
  const stop = () => {
    for (const child of children) child.kill('SIGTERM');
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await Promise.all(
    children.map(
      (child) =>
        new Promise((done, reject) => {
          child.once('error', (error) => {
            stop();
            reject(error);
          });
          child.once('exit', (code, signal) => {
            stop();
            if (code && !signal)
              reject(new Error(`Vite 验收服务器退出：${code}`));
            else done();
          });
        }),
    ),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
