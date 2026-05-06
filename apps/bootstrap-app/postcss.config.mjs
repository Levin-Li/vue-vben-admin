import tailwindConfig from './tailwind.config.mjs';

export default {
  plugins: {
    autoprefixer: {},
    'postcss-antd-fixes': { prefixes: ['ant', 'el'] },
    'postcss-import': {},
    'postcss-preset-env': {},
    tailwindcss: { config: tailwindConfig },
    'tailwindcss/nesting': {},
  },
};
