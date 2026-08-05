import { Controller, Get } from '@nestjs/common';
import { ConfigDataService } from './config-data.service';

@Controller('config')
export class ConfigDataController {
  constructor(private readonly configDataService: ConfigDataService) {}

  @Get('bunkers')
  getBunkers() {
    return this.configDataService.getBunkers();
  }

  @Get('cataclysms')
  getCataclysms() {
    return this.configDataService.getCataclysms();
  }
}
