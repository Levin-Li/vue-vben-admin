export interface TemplateVariable {
  key: string;
  required: boolean;
  title: string;
}

const VARIABLE_KEY = /^[a-z]\w{0,63}$/i;

// 页面只接受服务端支持的纯文本占位符，不把任意 JSON 当作模板规则提交。
export function normalizeTemplateVariables(value: unknown): TemplateVariable[] {
  let source =
    value === null || value === undefined || value === '' ? [] : value;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      throw new Error('填写项格式不正确，请逐项重新填写');
    }
  }

  if (!Array.isArray(source) || source.length > 100) {
    throw new Error('合同填写项最多添加 100 项');
  }

  const seen = new Set<string>();
  return source.map((item, index) => {
    const position = `第 ${index + 1} 项`;
    const key = typeof item?.key === 'string' ? item.key.trim() : '';
    const title = typeof item?.title === 'string' ? item.title.trim() : '';

    if (!VARIABLE_KEY.test(key)) {
      throw new Error(
        `${position}的变量名须以英文字母开头，只能使用字母、数字和下划线`,
      );
    }
    if (seen.has(key)) {
      throw new Error(`变量名“${key}”重复，请只保留一项`);
    }
    if (!title || title.length > 128) {
      throw new Error(`${position}的填写名称不能为空，且不能超过 128 个字`);
    }

    seen.add(key);
    return { key, title, required: item.required === true };
  });
}
