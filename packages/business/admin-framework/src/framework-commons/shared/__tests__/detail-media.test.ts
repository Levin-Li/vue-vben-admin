import { describe, expect, it } from 'vitest';

import { getDetailMediaResources } from '../detail-media';

const base = 'https://admin.example.test/users';

describe('详情媒体地址', () => {
  it('保留签名 URL 并从路径取得中文 PDF 文件名', () => {
    const url = '/lfs/%E8%AF%B4%E6%98%8E.PDF?signature=a,b&expires=123#page=2';
    expect(getDetailMediaResources(url, base)).toEqual([
      { name: '说明.PDF', pdf: true, url },
    ]);
  });

  it('保留图集顺序和单 URL 中的逗号', () => {
    expect(
      getDetailMediaResources(
        ['/lfs/a.png', 'https://cdn.example.test/b.png?v=1,2'],
        base,
      ).map((item) => item.url),
    ).toEqual(['/lfs/a.png', 'https://cdn.example.test/b.png?v=1,2']);
    expect(
      getDetailMediaResources('https://cdn.example.test/a,b.png', base),
    ).toHaveLength(1);
  });

  it('拒绝活动协议、控制字符、凭据及非字符串资源', () => {
    for (const value of [
      'javascript:alert(1)',
      'data:text/html,hello',
      'file:///etc/passwd',
      'blob:https://admin.example.test/id',
      'java\nscript:alert(1)',
      'https://user:pass@example.test/a',
      'https://[',
      {},
      null,
      123,
    ]) {
      expect(getDetailMediaResources(value, base)[0]?.url).toBeUndefined();
    }
  });

  it('验证 PDF 类型不受查询参数或片段伪装影响，非法转义不抛异常', () => {
    expect(
      getDetailMediaResources('/file.txt?name=test.pdf', base)[0]?.pdf,
    ).toBe(false);
    expect(getDetailMediaResources('/%ZZ.pdf', base)[0]).toMatchObject({
      name: '%ZZ.pdf',
      pdf: true,
    });
  });
});
