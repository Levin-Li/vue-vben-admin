import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  clean: true,
  declaration: true,
  entries: [
    {
      builder: 'mkdist',
      input: './src',
      loaders: ['vue'],
      pattern: ['**/*.vue'],
    },
    {
      builder: 'mkdist',
      format: 'esm',
      input: './src',
      loaders: ['js'],
      // 单测仅参与开发验证，不作为运行时模块输出到发布目录。
      pattern: ['**/*.ts', '!**/*.test.ts'],
    },
  ],
});
