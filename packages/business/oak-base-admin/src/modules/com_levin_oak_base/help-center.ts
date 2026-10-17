import manifest from './help-content/manifest.json';

export const HELP_CENTER_PATH = '/clob/V1/HelpCenter';

export interface HelpDocument {
  audience: '开发者' | '用户' | '管理员';
  content: string;
  id: string;
  module: string;
  pages: Array<{ path: string; view: string }>;
  sha256: string;
  source: string;
  title: string;
  type: '使用手册' | '使用指南' | '实现说明' | '开发指南';
}

// 构建期生成的正文由 Vite 按需编入应用，不在浏览器中扫描项目文件。
const markdownFiles = import.meta.glob('./help-content/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

export const helpDocuments: HelpDocument[] = manifest.documents.map((entry) => {
  const content = markdownFiles[`./help-content/${entry.id}.md`];
  if (typeof content !== 'string')
    throw new Error(`帮助文档正文缺失：${entry.id}`);
  return { ...entry, content } as HelpDocument;
});

export const helpCenterVersion = manifest.version;

export function helpDocumentUrl(id: string, section?: string) {
  const query = new URLSearchParams({ doc: id });
  return `${HELP_CENTER_PATH}?${query}${section ? `#${encodeURIComponent(section)}` : ''}`;
}

export function findHelpDocument(id: string) {
  return helpDocuments.find((document) => document.id === id);
}
