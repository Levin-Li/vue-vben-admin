import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  clean: true,
  declaration: true,
  entries: [
    {
      builder: 'mkdist',
      input: './src',
      pattern: ['**/*'],
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
      pattern: ['**/*.ts'],
    },
  ],
});
