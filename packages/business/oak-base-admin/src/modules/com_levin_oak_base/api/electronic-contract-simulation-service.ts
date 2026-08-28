import { RequestService, Service } from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/EContractSimulation',
  controllerClass: 'com.levin.oak.base.controller.EContractSimulationController',
  title: '电子合同本机模拟器',
  type: '测试工具-电子合同本机模拟器',
})
class ElectronicContractSimulationService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  async complete(data?: any, options?: any) {
    return this.post('complete', { ...options, data });
  }
}

export const electronicContractSimulationService =
  new ElectronicContractSimulationService();
