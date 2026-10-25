import type { DataAttrStaticContract } from '@levin/admin-framework';

import { registerDataAttrStaticContract } from '@levin/admin-framework';

import contract from './data-attr-contract.json';

/** 安装构建阶段核对的 API 字段声明；不读取用户许可或发起 HTTP 请求。 */
export function registerOakDataAttrContract() {
  registerDataAttrStaticContract(contract as unknown as DataAttrStaticContract);
}
