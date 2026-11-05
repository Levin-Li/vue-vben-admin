import { createApp, h } from 'vue';
import { createPinia } from 'pinia';
import '@vben/runtime/styles';
import '@vben/runtime/styles/antd';
import ResourcePermissionDialog from '../../../../../packages/business/admin-framework/src/framework-commons/shared/resource-permission-dialog.vue';
import { setAdminFrameworkRuntime } from '../../../../../packages/business/admin-framework/src/framework-commons/runtime';
import { rbacService } from '../../../../../packages/business/admin-framework/src/framework-commons/app/api/rbac-service';
const group = (name:string) => ({name, permissionExpr:`example:group:${name}:access`, entityScope:true, sourceKey:`Contract#${name}`, attributes:[name+'字段'], remark:''});
const groups = ['财务信息','联系人信息','开票信息'].map(group);
const attrs = [
 {attribute:'type', entityClass:'Contract', name:'客户类型', sourceKind:'enum', sourceKey:'Contract$Type', values:[{name:'Customer',label:'客户',permissionExpr:'old:A'},{name:'Supplier',label:'供应商',permissionExpr:'old:B'}]},
 {attribute:'level', entityClass:'Contract', name:'客户等级', sourceKind:'dict', sourceKey:'customer_level', values:[{name:'VIP',label:'贵宾',permissionExpr:'old:C'},{name:'NORMAL',label:'普通',permissionExpr:'old:D'}]},
];
const op=(id:string,name:string) => ({id,name,nodeType:'Action',permissionExpr:`example:业务数据-合同::${name}`,attrGroups:groups,dataAttrs:attrs});
const tree = [{id:'module',name:'示例',nodeType:'Module',children:[{id:'contract',name:'合同',nodeType:'ResourceType',wildcardOperation:'example:业务数据-合同::*',children:[op('list','查询列表'),op('detail','查看详情'),op('create','新增'),op('update','修改'),op('delete','删除')]}]}];
const mock = async () => ({id:'test-role',name:'隔离角色',permissionList:['@example:业务数据-合同::查询列表:@财务信息@联系人信息|enum#Contract$Type#type@Customer|dict#customer_level#level@VIP','@example:业务数据-合同::新增:@开票信息','example:业务数据-合同::修改']});
setAdminFrameworkRuntime({requestClient:{get:mock,put:mock,post:mock,delete:mock,request:mock} as any});
(rbacService as any).fetchAuthorizedPermissionTree=async()=>tree;
(rbacService as any).fetchAuthorizedResourceModules=async()=>[];
(rbacService as any).getAuthorizedMenuList=async()=>[];
createApp({setup(){return ()=>h(ResourcePermissionDialog,{open:true,record:{id:'test-role'}})}}).use(createPinia()).mount('#app');
