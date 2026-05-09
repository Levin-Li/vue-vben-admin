# 前端 API 开发规则

## 一、基本原则

1. 前端 API 接口应统一放在所属 API 目录下管理，不应长期分散在页面目录中维护。所属 API 目录包括业务模块自己的 `api` 目录和跨模块公共能力所在的公共 API 目录；后续规则中提到的 API 目录均按这个含义理解。

2. API 目录与页面目录职责分离：
   - 页面目录负责页面实现、页面配置、页面子组件、页面专属交互。
   - API 目录负责接口地址、模块前缀、请求函数、模块级公共接口复用。

3. 页面可以同时调用多个后端模块的 API。因此前端页面目录不应承担模块 API 前缀拼接和模块接口归属管理。页面只应按需引入对应模块的 API 函数。

4. 页面内直接使用 `requestClient` 拼接接口地址，只能作为临时过渡，不应成为长期方案。

5. 当前项目不以前端 SDK 代码生成作为 API 开发前提。生成模板、历史 SDK 或后端代码生成工具只能作为源码理解参考，不能替代按模块、按控制器维护 API 接口文件。

## 二、按模块归组

6. 前端 API 模块应按后端模块划分组织，而不是按页面目录组织。

7. 每个后端模块对应一个前端 API 模块目录或模块文件。

8. 模块级 API 前缀、请求封装、公共接口工具，应放在对应模块的 API 目录中统一处理。

9. 不允许把模块 API 前缀逻辑散落在页面目录、页面配置或页面组件中重复实现。

## 三、按控制器划分

10. 在模块 API 目录内部，接口文件应继续按 Spring MVC 控制器独立划分。

11. 不允许把多个控制器的接口长期混在同一个“大而全”的通用 API 文件里维护。

12. 每个业务控制器对应的前端 API，应有明确的独立模块或文件归属。例如：
    - 用户控制器相关接口归属用户 API 模块。
    - 字典控制器相关接口归属字典 API 模块。
    - 菜单控制器相关接口归属菜单 API 模块。

13. 如果业务控制器和父类控制器共同组成一个页面模块，API 归属仍以业务控制器对应模块为主。父类控制器方法只是该 API 模块的一部分来源。

14. 前端 API 文件或 API 方法必须明确标注对应的 Java 控制器完整限定类名。标注应使用后端源码中的实际完整类名，例如 `com.levin.oak.base.web.controller.rbac.RbacController`，避免只写接口路径、页面名称或简单类名导致后续无法追溯接口来源。使用 `@Service` 装饰器的 API 模块，应优先通过 `controllerClass` 元数据标注，例如 `controllerClass: 'com.levin.oak.base.controller.BizAccessLogController'`。

    按控制器划分的业务 API 服务文件，文件名统一使用 `xxx-service.ts`；服务类名统一使用 `XxxService`；服务实例名统一使用 `xxxService`。服务类名和实例名按前端 API 资源名或业务服务名命名，不按 Java 控制器类名机械追加后缀；即使后端控制器叫 `RbacController`，前端也应命名为 `RbacService` / `rbacService`，不应命名为 `RbacControllerService` / `rbacControllerService`。

    `controllerClass` 应直接写完整 Java 控制器类名字符串，不应为了单次使用再抽取 `XXX_CONTROLLER_CLASS` 这类常量。只有同一个值在多个真实业务位置复用且能减少维护成本时，才允许抽取常量。

    API 缺漏核对应以后端 Java 控制器为权威清单，而不是以前端现有 API 文件为清单。核对步骤必须包括：
    - 先枚举目标后端模块中的所有具体 Spring MVC 控制器类，例如 `*Controller.java`；抽象基类、无请求入口的父类不生成独立 API service。
    - 每个具体控制器都必须在对应前端公共模块或业务模块 API 目录中存在一个 `xxx-service.ts` 文件，并通过 `@Service({ controllerClass: '完整限定类名' })` 标注来源。
    - 对每个控制器逐个核对 `@RequestMapping`、`@GetMapping`、`@PostMapping`、`@PutMapping`、`@DeleteMapping` 等公开接口方法，确认前端 service 中没有漏方法、错 HTTP 方法、错路径、错 `params/data/path` 参数承载方式。
    - 对每个控制器方法逐个核对 `@Operation`、`@ResAuthorize`、`@CRUD.ListTable`、`@CRUD.Op` 等注解，前端 API 元数据必须来自后端源码，不得根据页面表现自行补猜。
    - 核对时还要反查旧散函数、旧聚合 API 文件和页面内直接请求，确保没有同一控制器被多个前端定义源重复维护。

    标准 API 服务文件参考案例，文件名为 `demo-service.ts`：

    ```ts
    import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
    import { RequestService } from '@levin/admin-framework';
    import { OAK_BASE_API_MODULE } from './_module';

    @Service({
      basePath: '/Demo',
      controllerClass: 'com.levin.oak.base.controller.BizDemoController',
      description: 'Demo管理',
      title: 'Demo',
      type: '专家数据-Demo',
    })
    export class DemoService extends RequestService {
      constructor() {
        super(OAK_BASE_API_MODULE);
      }

      @ResAuthorize({
        domain: 'com.levin.oak.base',
        type: '专家数据-Demo',
        action: '批量新增',
        onlyRequireAuthenticated: true,
      })
      async batchCreate(data?: any, options?: any) {
        return this.post('batchCreate', {
          ...options,
          data,
        });
      }

      @ResAuthorize({
        domain: 'com.levin.oak.base',
        type: '专家数据-Demo',
        action: '批量删除',
        onlyRequireAuthenticated: true,
      })
      @CRUD.Op({
        opRefTargetType: 'MultipleRow',
      })
      async batchDelete(params?: any, options?: any) {
        return this.deleteRequest('batchDelete', {
          ...options,
          params,
        });
      }

      @ResAuthorize({
        domain: 'com.levin.oak.base',
        type: '专家数据-Demo',
        action: '批量更新',
        onlyRequireAuthenticated: true,
      })
      async batchUpdate(data?: any, options?: any) {
        return this.put('batchUpdate', {
          ...options,
          data,
        });
      }

      @ResAuthorize({
        domain: 'com.levin.oak.base',
        type: '专家数据-Demo',
        action: '清除缓存',
        onlyRequireAuthenticated: true,
      })
      async clearCache(params?: any, options?: any) {
        return this.get('clearCache', {
          ...options,
          params,
        });
      }

      @ResAuthorize({
        domain: 'com.levin.oak.base',
        type: '专家数据-Demo',
        action: '新增',
        onlyRequireAuthenticated: true,
      })
      @CRUD.Op({
        opRefTargetType: 'None',
      })
      async create(data?: any, options?: any) {
        return this.post('create', {
          ...options,
          data,
        });
      }

      @ResAuthorize({
        domain: 'com.levin.oak.base',
        type: '专家数据-Demo',
        action: '删除',
        onlyRequireAuthenticated: true,
      })
      @CRUD.Op()
      async delete(params?: any, options?: any) {
        return this.deleteRequest('delete', {
          ...options,
          params,
        });
      }

      @ResAuthorize({
        domain: 'com.levin.oak.base',
        type: '专家数据-Demo',
        action: '查询列表',
        onlyRequireAuthenticated: true,
      })
      @CRUD.ListTable({
        refEntityClass: 'com.levin.oak.base.entities.Demo',
      })
      async list(params?: any, options?: any) {
        return this.get('list', {
          ...options,
          params,
        });
      }

      @ResAuthorize({
        domain: 'com.levin.oak.base',
        type: '专家数据-Demo',
        action: '查看详情',
        onlyRequireAuthenticated: true,
      })
      @CRUD.Op({
        confirmText: 'None',
      })
      async retrieve(params?: any, options?: any) {
        return this.get('retrieve', {
          ...options,
          params,
        });
      }

      @ResAuthorize({
        domain: 'com.levin.oak.base',
        type: '专家数据-Demo',
        action: '统计',
        onlyRequireAuthenticated: true,
      })
      async stat(params?: any, options?: any) {
        return this.get('stat', {
          ...options,
          params,
        });
      }

      @ResAuthorize({
        domain: 'com.levin.oak.base',
        type: '专家数据-Demo',
        action: '统计',
        onlyRequireAuthenticated: true,
      })
      async testRequestBody1(data?: any, options?: any) {
        return this.post('testRequestBody1', {
          ...options,
          data,
        });
      }

      @ResAuthorize({
        domain: 'com.levin.oak.base',
        type: '专家数据-Demo',
        action: '统计',
        onlyRequireAuthenticated: true,
      })
      async testRequestBody2(data?: any, options?: any) {
        return this.post('testRequestBody2', {
          ...options,
          data,
        });
      }

      @ResAuthorize({
        domain: 'com.levin.oak.base',
        type: '专家数据-Demo',
        action: '统计',
        onlyRequireAuthenticated: true,
      })
      async testRequestBody3(data?: any, options?: any) {
        return this.post('testRequestBody3', {
          ...options,
          data,
        });
      }

      @ResAuthorize({
        domain: 'com.levin.oak.base',
        type: '专家数据-Demo',
        action: '更新',
        onlyRequireAuthenticated: true,
      })
      @CRUD.Op()
      async update(data?: any, options?: any) {
        return this.put('update', {
          ...options,
          data,
        });
      }
    }

    export const demoService = new DemoService();
    ```

## 四、模块级统一处理

15. 模块级 API 应统一处理以下内容：
    - 模块接口前缀
    - 模块级请求 helper
    - 枚举、字典、选项加载
    - 模块内统一错误处理和请求参数约定
    - 模块内稳定公共能力

    模块级 API 不应承载具体控制器的 CRUD 方法；具体业务接口仍应放在对应控制器 API 文件中。

16. 页面实现应优先调用所属 API 目录导出的模块 API 函数，而不是在页面中直接拼接模块前缀和接口路径。

17. 如果某页面需要同时调用多个模块的接口，应分别引入对应模块的 API 函数，而不是在页面内自行处理模块前缀切换。

18. 当前阶段，前端 API 方法的请求参数和返回参数不建议过早具体化。API 样板应优先明确控制器归属、请求路径、请求方法、权限注解和模块前缀。方法参数可先使用 `payload?: any` 这类宽松参数，不定义具体 DTO、对象结构或返回类型，待页面和后端 DTO 边界稳定后再逐步细化。

19. HTTP 方法可以通过父类请求 helper 表达，例如 `this.get(...)`、`this.post(...)`、`this.put(...)`、`this.deleteRequest(...)`，不需要在每个 API 方法里重复写 `method` 字段。但 `params` 和 `data` 的选择必须由具体 API 方法显式写出，因为它决定参数进入 URL/query 还是 request body。父类 `RequestOptions` 应支持底层 request/axios 配置的全部能力，只对 `path` 做模块前缀和控制器路径拼接加工。

20. `POST` / `PUT` 方法不能默认只暴露 `data`。如果 Spring 控制器方法除 `@RequestBody` 外，还存在非 body 参数，例如 `@RequestParam`、`@PathVariable`、普通表单参数或分页参数，前端 API 方法必须同时支持传入 `params` 或明确的路径参数。如果控制器方法存在明确的 `@RequestHeader` 参数，前端 API 方法也必须支持传入 `headers`。这些参数能力应通过底层请求配置透传，不能在 API 方法中丢失。

21. 后端默认更新策略会忽略空值，空字符串、空集合、空数组都属于空值。当前端业务允许用户主动清空某个字段时，更新请求必须同时提交该字段名到 `forceUpdateFields`，例如清空资源权限时提交 `forceUpdateFields: ['permissionList']`，清空组织数据权限时提交 `forceUpdateFields: ['orgScopeList']`。该参数只应包含本次确实允许强制覆盖的字段，不应为了省事扩大到无关字段。

## 五、公共 API 边界

22. 对于跨模块通用能力，例如登录、认证、RBAC、上传、OAuth、公共枚举、公共字典，可以继续保留在公共 API 目录下的公共模块中，但必须边界清晰。

23. 不得以“通用能力”为由，将本应按模块、按控制器划分的业务接口重新混合到公共 API 文件中。

## 六、API 权限元数据规则

24. 前端 API 方法应支持标注其对应的权限元数据，用于统一处理接口访问权限和按钮权限。

25. API 方法上的权限元数据，应以后端控制器方法上的 `@ResAuthorize` 为权威来源，不应由前端手工发明或随意猜测。

26. 前端 API 方法上的 `@ResAuthorize` 是权限声明源。页面、按钮和调用前权限判断应基于 `@ResAuthorize` 元数据统一处理，不应在页面内散写权限表达式。

27. API 方法权限元数据应以当前后端 `com.levin.commons.rbac.ResAuthorize` 注解定义为准。前端 `@ResAuthorize` 支持的属性必须和后端注解完全一致，包括 `domain`、`type`、`res`、`action`、`ignored`、`onlyRequireAuthenticated`、`anyUserTypes`、`confidentialLevel`、`isAndMode`、`anyRoles`、`verifyExpression`、`remark`。前端 `@ResAuthorize` 元数据只表达注解本身的属性，不保留后端已经删除的历史属性，也不额外加入派生字段；例如旧版本注解中出现过但当前后端已不存在的 `actionTypes`、`orgDataScope` 不应出现在前端类型中。

28. 当页面操作按钮明确对应某个 API 方法时，应优先使用该 API 方法上的权限元数据进行权限判断。无 API 权限时，按钮不应展示或不应允许触发调用。

29. 操作按钮通常关联 API 方法，因此按钮权限和 API 权限应尽量保持单一来源。不应让页面按钮权限、API 方法权限、控制器方法权限三处长期分离维护。

30. `onlyRequireAuthenticated=true` 的 API，应视为“需要登录但不要求具体权限”的接口。

31. `ignored=true` 的 API，应视为“不参与权限限制”的接口。前端不得为这类 API 额外强加具体权限判断，但仍可按页面业务规则决定是否展示按钮。

32. 如果前端 API 方法尚未挂接权限元数据，但后端控制器已存在 `@ResAuthorize` 信息，应优先补 API 层元数据，而不是继续在页面里散写权限判断。

33. 页面开发时，若按钮已绑定某个 API 方法，则应尽量通过该 API 方法上的权限元数据统一控制：
    - 按钮可见性
    - 按钮可点击性
    - 执行动作前权限预检

34. API 权限元数据的组织位置应在所属 API 目录内解决，不应散落在页面目录中。

35. 前端 API 方法的权限元数据，应采用接近 Java 注解的方式表达。

36. 推荐使用注解式包装函数为 API 方法挂载权限元数据。

37. 不建议把权限元数据散写成页面局部常量或按钮内联字符串。

38. 页面和按钮应优先读取 API 方法上的权限注解元数据。

    CRUD 页面配置应通过 `apiService` 绑定对应的 `xxxService` 实例；通用 CRUD 组件应优先从 `apiService.list/create/update/delete/retrieve` 方法上的 `@ResAuthorize` 注解读取权限，不应在页面配置中重复手写 `createPermission`、`deletePermission`、`editPermission`、`queryPermission`。

39. 前端权限注解命名为 `@ResAuthorize`，语义应对齐后端控制器方法上的 `@ResAuthorize`。

40. 前端 `@ResAuthorize` 应像 Java 注解一样支持默认值。API 方法只需要定义需要覆盖的属性；未定义的属性按默认值处理。

41. 前端 `@ResAuthorize` 的属性清单以第 27 条为准，并应照搬后端当前 `@ResAuthorize` 注解属性，保持同名同义和相同默认值。后端注解中不存在或已经删除的属性，不应继续出现在前端注解元数据定义中。由 `domain/type/res/action` 等属性计算出的权限表达式，只能作为运行时权限判断的派生结果，不应写回 `@ResAuthorize` 元数据类型。

42. 前端 `@ResAuthorize` 中资源许可相关属性的书写顺序应为 `domain`、`type`、`res`、`action`。

43. 如果后端 `@ResAuthorize.type` 的值为类似 `SYS_TYPE_NAME + "-"` 这种以 `-` 结尾的类型前缀，生成前端 API 时必须先追加当前控制器 `@Tag` 注解的 `name` 属性，前端 API 文件中的 `@Service.type` 和方法级 `@ResAuthorize.type` 都必须保存解析后的完整权限类型，不得保留 `Dummy-`、`系统数据-` 这类半截前缀。前端 `@Service.title` 对应控制器 `@Tag.name`，`@Service.type` 表示控制器级完整权限类型，例如 `type = "系统数据-"` 且控制器 `@Tag(name = "用户")`，前端应写成 `"系统数据-用户"`。该推导必须来自后端控制器源码注解；通用页面或按钮在缺少方法级 `@ResAuthorize` 时，只能从 API service 的 `@Service.type` 读取完整权限类型，不得通过页面标题、菜单名、路由名或“去掉管理”等前端文案规则拼权限名称。

## 七、与页面规则的关系

44. 控制器方法上的 `@CRUD.ListTable` 和 `@CRUD.Op` 注解，也应按后端源码原样复制到对应前端 API 方法上。这些注解是页面列表、操作按钮、操作位置、确认框、显示条件和动作行为的 API 层声明源，不应散写成页面局部常量。

45. 前端 API 方法上的 CRUD 注解应采用接近 Java 注解的方式表达。推荐使用 `@CRUD.ListTable({...})` 和 `@CRUD.Op({...})` 这类注解式包装函数挂载元数据；后端为无属性注解时，前端也应写成 `@CRUD.Op()` 或 `@CRUD.ListTable()`。

46. `@CRUD.ListTable` 当前应支持并照搬后端属性：`name`、`title`、`refEntityClass`、`visibleOn`、`style`、`desc`。其中 `refEntityClass` 在前端以 Java 类全名字符串表达，例如 `com.levin.oak.base.entities.User`。

47. `@CRUD.Op` 当前应支持并照搬后端属性：`name`、`label`、`icon`、`confirmText`、`confirmTitle`、`level`、`action`、`viewContainerType`、`actionData`、`visibleOn`、`successAction`、`failAction`、`resultActionData`、`opRefTargetType`、`opRefTargetListName`、`desc`。后端注解中不存在或已经删除的历史属性，不应继续出现在前端 CRUD 注解元数据定义中。

48. 前端 CRUD 注解应像 Java 注解一样支持默认值。API 方法只需要定义后端源码中显式覆盖的属性；未定义的属性按后端注解默认值处理。

49. 页面操作按钮若绑定某个 API 方法，应优先读取该 API 方法上的 `@CRUD.Op` 元数据决定按钮文案、位置、确认框、显示条件和成功/失败动作。页面列表若绑定某个 API 方法，应优先读取该 API 方法上的 `@CRUD.ListTable` 元数据识别列表名称、关联实体和显示条件。

50. 所有路径参数都必须统一 URL 编码，不管参数是否为 Java 类名。公共 API 请求层应对路径中的每个 segment 做 `encodeURIComponent`，静态路径段编码后不应改变语义，动态路径段中存在空格、`$`、`<`、`>`、`/` 等特殊字符时也能安全提交。已经编码过的路径段应保持稳定，避免重复编码。

51. 查询参数优先通过 axios/request 的 `params` 对象提交，并交给统一 `paramsSerializer` 编码。只有在确实需要手写查询串时，才对查询参数值显式编码；不得把已经交给 `params` 的值再手工编码，避免 `%` 被二次编码。

52. 页面按模块包名归组，API 也应按模块归组，两者相互对应，但职责独立。

53. 页面开发规则用于指导页面实现，API 开发规则用于指导接口组织与复用，两者不得混用。
