import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  clean: true,
  declaration: true,
  entries: [
    {
      builder: 'mkdist',
      input: './src',
      pattern: [
        '**/*.css',
        '**/*.scss',
        '**/*.json',
        '**/*.svg',
        '**/*.png',
        '**/*.jpg',
        '**/*.jpeg',
        '**/*.gif',
        '**/*.webp',
      ],
    },
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
      pattern: ['**/*.ts'],
    },
  ],
});
