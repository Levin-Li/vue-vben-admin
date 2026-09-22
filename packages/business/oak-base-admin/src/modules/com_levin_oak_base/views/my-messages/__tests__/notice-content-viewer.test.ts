import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import NoticeContentViewer from '../notice-content-viewer.vue';

describe('通知内容只读展示', () => {
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
