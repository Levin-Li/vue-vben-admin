import { execFileSync } from 'node:child_process';

import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  clean: true,
  declaration: false,
  hooks: {
    'mkdist:entry:options': (_context, _entry, options) => {
      options.declaration = false;
    },
    'mkdist:done': (context) => {
      execFileSync(
        'pnpm',
        [
          'exec',
          'vue-tsc',
          '-p',
          'tsconfig.json',
          '--declaration',
          '--emitDeclarationOnly',
          '--noEmit',
          'false',
          '--rootDir',
          'src',
          '--outDir',
          'dist',
        ],
        { cwd: context.options.rootDir, stdio: 'inherit' },
      );
    },
  },
  entries: [
    {
      builder: 'mkdist',
      input: './src',
      loaders: [],
      pattern: ['**/*.css', '**/*.scss', '**/*.svg', '**/*.json'],
    },
    {
      builder: 'mkdist',
      input: './src',
      loaders: [],
      pattern: ['**/*.vue'],
    },
    {
      builder: 'mkdist',
      format: 'esm',
      input: './src',
      loaders: ['js'],
      pattern: ['**/*.ts'],
    },
  ],
});
