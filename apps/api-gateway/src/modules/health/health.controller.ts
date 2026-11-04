
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
} from '@nestjs/terminus';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
  ) {}

  @Get()
  @HealthCheck()
  @SkipResponseTransform()
  check() {
    return this.health.check([]);
  }
}
