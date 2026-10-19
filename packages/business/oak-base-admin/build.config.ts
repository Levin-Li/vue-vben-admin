import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { defineBuildConfig } from 'unbuild';

import { verifyBrowserRuntime } from '../../../scripts/ai-browser-consumer-gate.mjs';

export default defineBuildConfig({
  clean: true,
  declaration: true,
  entries: [
    { builder: 'rollup', input: './src/ai-sdk-browser' },
    {
      builder: 'mkdist',
      input: './src',
      pattern: ['**/*', '!ai-sdk-browser.ts'],
    },
    {
      builder: 'mkdist',
      input: './src',
      loaders: ['vue'],
      pattern: ['**/*.vue'],
    },
    {
      builder: 'mkdist',
      esbuild: {
        tsconfigRaw: {
          compilerOptions: {
            experimentalDecorators: true,
          },
        },
      },
      format: 'esm',
      input: './src',
      loaders: ['js'],
      pattern: ['**/*.ts', '!ai-sdk-browser.ts'],
    },
  ],
  // 模型 SDK 的 CommonJS 互操作在本包构建完成，消费方无需预打包补丁。
  hooks: {
    // 每次构建即阻断不自包含的浏览器入口，发布前不能漏过裸依赖或 Node 导入。
    'build:done': function (context) {
      verifyBrowserRuntime(
        context.pkg,
        readFileSync(
          resolve(
            context.options.rootDir,
            context.options.outDir,
            'ai-sdk-browser.mjs',
          ),
          'utf8',
        ),
      );
      // 上传会重新打包；若提供浏览器已验收字节指纹，则关键运行代码必须保持一致。
      for (const [file, variable] of [
        ['ai-sdk-browser.mjs', 'LEVIN_AI_BROWSER_RUNTIME_SHA256'],
        [
          'modules/com_levin_oak_base/api/ai-browser-agent-service.mjs',
          'LEVIN_AI_BROWSER_TRANSPORT_SHA256',
        ],
      ] as const) {
        const expected = process.env[variable];
        if (!expected) continue;
        const actual = createHash('sha256')
          .update(
            readFileSync(
              resolve(context.options.rootDir, context.options.outDir, file),
            ),
          )
          .digest('hex');
        if (!/^[a-f\d]{64}$/.test(expected) || actual !== expected) {
          throw new Error(`浏览器已验收构件发生变化：${file}`);
        }
      }
    },
    'build:before': function (context) {
      context.options.externals = context.options.externals.filter(
        (id) => id !== 'ai' && id !== '@ai-sdk/openai-compatible',
      );
    },
    // 类型引用保留官方声明；仅 JavaScript 运行时需要内联，避免重复打包第三方类型。
    'rollup:dts:options': function (_context, options) {
      options.external = (id) =>
        id === 'ai' || id === '@ai-sdk/openai-compatible';
    },
  },
  rollup: {
    inlineDependencies: true,
    output: { inlineDynamicImports: true },
    resolve: {
      browser: true,
      exportConditions: ['browser'],
      preferBuiltins: false,
    },
  },
});
