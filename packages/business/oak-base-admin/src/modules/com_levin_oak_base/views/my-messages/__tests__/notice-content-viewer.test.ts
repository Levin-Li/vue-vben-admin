import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import NoticeContentViewer from '../notice-content-viewer.vue';

describe('通知内容只读展示', () => {
  it('markdown 展示标题、列表、强调和安全链接，不执行 HTML 或远程图片', () => {
    const wrapper = mount(NoticeContentViewer, {
      props: {
        contentType: 'Markdown',
        content:
          '# 报销通知\n- **财务已复核**\n[详情](https://example.com/detail)\n<script>alert(1)</script>\n[脚本](javascript:alert(1))\n![追踪图片](https://example.com/pixel)',
      },
    });
    expect(wrapper.get('h1').text()).toBe('报销通知');
    expect(wrapper.get('li strong').text()).toBe('财务已复核');
    expect(wrapper.get('a').attributes('rel')).toBe('noopener noreferrer');
    expect(wrapper.find('script').exists()).toBe(false);
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('[href^="javascript:"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('<script>');
  });

  it('服务端渲染后的变量保持字面字符，只有模板作者的链接可点击', () => {
    // 此内容等同服务端 render 对节点名「[点击](https://evil.example) A&B <测试>」的输出。
    const content =
      '# 流程通知\n\\[点击\\]\\(https://evil\\.example\\) A&B \\<测试\\>\n\\*\\*变量加粗\\*\\* \\`代码\\`\n[模板详情](https://example.com/detail?tenant=A&org=B)';
    const wrapper = mount(NoticeContentViewer, {
      props: { content, contentType: 'Markdown' },
    });
    expect(wrapper.findAll('a')).toHaveLength(1);
    expect(wrapper.get('a').text()).toBe('模板详情');
    expect(wrapper.get('a').attributes('href')).toBe(
      'https://example.com/detail?tenant=A&org=B',
    );
    expect(wrapper.text()).toContain('[点击](https://evil.example) A&B <测试>');
    expect(wrapper.text()).toContain('**变量加粗** `代码`');
    expect(wrapper.find('strong').exists()).toBe(false);
    expect(wrapper.find('code').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('&amp;');
  });

  it('转义的块级语法与全部标点保持字面，正常列表标题不受影响', () => {
    const content = String.raw`# 作者标题
\# 变量标题
\- 变量列表
\> 变量引用
\{变量\} \[方括号\] \(括号\) \+ 加号 \! 感叹号 \| 竖线 \~ 波浪线 \\反斜杠
- 作者列表`;
    const wrapper = mount(NoticeContentViewer, {
      props: { content, contentType: 'Markdown' },
    });
    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.findAll('li')).toHaveLength(1);
    expect(wrapper.find('blockquote').exists()).toBe(false);
    expect(wrapper.text()).toContain('# 变量标题');
    expect(wrapper.text()).toContain('- 变量列表');
    expect(wrapper.text()).toContain('> 变量引用');
    expect(wrapper.text()).toContain(
      String.raw`{变量} [方括号] (括号) + 加号 ! 感叹号 | 竖线 ~ 波浪线 \反斜杠`,
    );
  });

  it('短信等普通文本保持字面内容，不误当 Markdown', () => {
    const wrapper = mount(NoticeContentViewer, {
      props: { content: '**纯文本**', contentType: 'Text' },
    });
    expect(wrapper.find('strong').exists()).toBe(false);
    expect(wrapper.get('pre').text()).toBe('**纯文本**');
  });

  it('在 sandbox iframe 中隔离网页内容', () => {
    const wrapper = mount(NoticeContentViewer, {
      props: {
        content: '<script>window.parent.postMessage("unsafe", "*")</script>',
        contentType: 'Html',
      },
    });

    const iframe = wrapper.get('iframe');
    expect(iframe.attributes('sandbox')).toBe('');
    expect(iframe.attributes('srcdoc')).toContain('<script>');
  });

  it('只加载 HTTPS 图片地址', () => {
    const wrapper = mount(NoticeContentViewer, {
      props: {
        content: 'https://cdn.example.com/notice.png',
        contentType: 'Pic',
      },
    });

    expect(wrapper.get('img').attributes('src')).toBe(
      'https://cdn.example.com/notice.png',
    );
  });

  it('按媒体与文件类型提供播放器或下载入口', () => {
    const video = mount(NoticeContentViewer, {
      props: {
        content: 'https://cdn.example.com/notice.mp4',
        contentType: 'Video',
      },
    });
    const audio = mount(NoticeContentViewer, {
      props: {
        content: 'https://cdn.example.com/notice.mp3',
        contentType: 'Audio',
      },
    });
    const file = mount(NoticeContentViewer, {
      props: {
        content: 'https://cdn.example.com/notice.pdf',
        contentType: 'File',
      },
    });

    expect(video.get('video').attributes('src')).toBe(
      'https://cdn.example.com/notice.mp4',
    );
    expect(audio.get('audio').attributes('src')).toBe(
      'https://cdn.example.com/notice.mp3',
    );
    expect(file.get('a').attributes('href')).toBe(
      'https://cdn.example.com/notice.pdf',
    );
  });

  it('拒绝脚本协议的文件地址', () => {
    const wrapper = mount(NoticeContentViewer, {
      props: {
        content: 'javascript:alert(1)',
        contentType: 'File',
      },
    });

    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.text()).toContain('通知内容地址无效');
  });

  it('对无效 JSON 载荷展示安全错误', () => {
    const wrapper = mount(NoticeContentViewer, {
      props: {
        content: '{invalid-json}',
        contentType: 'JsonSchema',
      },
    });

    expect(wrapper.text()).toContain('不是有效的 JSON');
  });
});
