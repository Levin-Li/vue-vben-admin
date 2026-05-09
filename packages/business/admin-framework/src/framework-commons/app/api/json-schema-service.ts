import { ResAuthorize, Service } from '../../api-authorize';
import { RequestService } from '../../request-service';

@Service({
  basePath: '/jsonSchema',
  controllerClass:
    'com.levin.oak.base.web.controller.commons.JsonSchemaController',
  description: 'JsonSchema',
  title: 'JsonSchema',
  type: '系统数据-JsonSchema',
})
export class JsonSchemaService extends RequestService {
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-JsonSchema',
    action: '生成JsonSchema',
  })
  async genJsonSchema(data?: any, options?: any) {
    return this.post('genJsonSchema', {
      ...options,
      data,
    });
  }
}

export const jsonSchemaService = new JsonSchemaService();
