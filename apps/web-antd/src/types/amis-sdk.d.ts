declare module 'amis/sdk/sdk.js' {
  export function amisRequire(moduleName: string): any;
}

declare module 'amis/sdk/rest.js';

declare module '*.css?url' {
  const url: string;
  export default url;
}
