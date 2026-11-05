import { createApp, h, ref } from 'vue';
import '@vben/runtime/styles';
import '@vben/runtime/styles/antd';
import ResourcePermissionTreeEditor from '../../../../../packages/business/admin-framework/src/framework-commons/shared/resource-permission-tree-editor.vue';
const wildcard = 'example:业务数据-合同::*';
const group = {name:'财务信息', permissionExpr:'example:group:finance:access', entityScope:true, sourceKey:'Contract#finance', attributes:['金额'], remark:''};
const attr = {attribute:'type', entityClass:'Contract', name:'客户类型', sourceKind:'enum', sourceKey:'Contract$Type', values:[{name:'Customer',label:'客户',permissionExpr:'old:A'},{name:'Supplier',label:'供应商',permissionExpr:'old:B'}]};
const tree = [{id:'module',name:'示例',nodeType:'Module',children:[{id:'contract',name:'合同',nodeType:'ResourceType',wildcardOperation:wildcard,children:[{id:'list',name:'查询列表',nodeType:'Action',permissionExpr:'example:业务数据-合同::查询列表',attrGroups:[group],dataAttrs:[attr]}]}]}];
createApp({ setup() { const value=ref<string[]>([]); return () => h('main', {style:'padding:32px'}, [h(ResourcePermissionTreeEditor as any,{permissionTree:tree,value:value.value,'onUpdate:value':(v:string[])=>value.value=v}),h('pre',{'data-test':'output'},JSON.stringify(value.value))]); } }).mount('#app');
