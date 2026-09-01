import jsep, { type Expression } from 'jsep';

function getMemberValue(node: any, context: Record<string, any>): any {
  let value = evaluateNode(node.object, context);
  const property = node.computed ? evaluateNode(node.property, context) : node.property.name;
  if (property === '__proto__' || property === 'constructor' || property === 'prototype') throw new Error('不允许访问危险属性');
  return value?.[property];
}

function evaluateNode(node: any, context: Record<string, any>): any {
  switch (node.type) {
    case 'Literal': return node.value;
    case 'Identifier':
      if (!(node.name in context)) throw new Error(`未知变量：${node.name}`);
      return context[node.name];
    case 'MemberExpression': return getMemberValue(node, context);
    case 'UnaryExpression': {
      const value = evaluateNode(node.argument, context);
      if (node.operator === '!') return !value;
      if (node.operator === '-') return -Number(value);
      if (node.operator === '+') return Number(value);
      throw new Error(`不支持的一元操作符：${node.operator}`);
    }
    case 'BinaryExpression': {
      const left = evaluateNode(node.left, context);
      // jsep 1.x may emit these as BinaryExpression rather than LogicalExpression.
      if (node.operator === '&&') return left && evaluateNode(node.right, context);
      if (node.operator === '||') return left || evaluateNode(node.right, context);
      const right = evaluateNode(node.right, context);
      switch (node.operator) {
        case '+': return typeof left === 'string' || typeof right === 'string' ? String(left ?? '') + String(right ?? '') : Number(left) + Number(right);
        case '-': return Number(left) - Number(right); case '*': return Number(left) * Number(right); case '/': return Number(left) / Number(right);
        case '==': return left == right; case '!=': return left != right; case '===': return left === right; case '!==': return left !== right;
        case '>': return left > right; case '>=': return left >= right; case '<': return left < right; case '<=': return left <= right;
        default: throw new Error(`不支持的二元操作符：${node.operator}`);
      }
    }
    case 'LogicalExpression': return node.operator === '&&' ? evaluateNode(node.left, context) && evaluateNode(node.right, context) : evaluateNode(node.left, context) || evaluateNode(node.right, context);
    case 'ConditionalExpression': return evaluateNode(node.test, context) ? evaluateNode(node.consequent, context) : evaluateNode(node.alternate, context);
    default: throw new Error(`不支持的表达式：${node.type}`);
  }
}

export function evaluateJavaScriptExpression(expression: string, context: Record<string, any>) {
  const ast: Expression = jsep(expression || 'null');
  return evaluateNode(ast, context);
}
