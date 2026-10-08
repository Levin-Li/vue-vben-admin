import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// 使用真实 HTML 入口验证资源加载前的策略及统计脚本的授权参数保护。
const html = readFileSync(
  new URL('../../apps/bootstrap-app/index.html', import.meta.url),
  'utf8',
);
const nginx = readFileSync(new URL('./nginx.conf', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('页面资源加载前声明 no-referrer', () => {
  const policy = html.indexOf('<meta name="referrer" content="no-referrer"');
  assert.ok(policy > 0 && policy < html.indexOf('<link'));
});

test('绑定桥接参数阻止统计脚本，普通页面维持原行为', () => {
  for (const search of [
    '?oauthBindCallback=temporary',
    '?oauthInAppCode=temporary',
    '?code=temporary',
    '?businessId=test',
  ]) {
    let externalScripts = 0;
    vm.runInNewContext(script, {
      URLSearchParams,
      window: { _VBEN_ADMIN_PRO_APP_CONF_: {}, location: { search } },
      document: {
        createElement: () => ({}),
        getElementsByTagName: () => [
          { parentNode: { insertBefore: () => externalScripts++ } },
        ],
      },
    });
    assert.equal(externalScripts, search.startsWith('?businessId') ? 1 : 0);
  }
});

test('部署模板代理 OAuth 并从日志中排除授权查询和 Referer', () => {
  assert.match(nginx, /location ~ \^\/\([^\n]*\|oauth\|/);
  assert.match(nginx, /add_header Referrer-Policy no-referrer always;/);
  const format = nginx.match(/log_format auth_safe([\s\S]*?);/)?.[1];
  assert.ok(format);
  assert.match(format, /\$uri/);
  assert.doesNotMatch(
    format,
    /\$request(?:\s|["'])|\$request_uri|\$args|\$http_referer/,
  );
  assert.match(nginx, /access_log \/var\/log\/nginx\/access.log auth_safe;/);
});
