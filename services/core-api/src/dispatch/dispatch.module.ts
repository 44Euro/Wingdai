import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../auth/admin.guard';
import { DispatchService } from './dispatch.service';
import { DispatchScheduler } from './dispatch.scheduler';
import { RiderService } from './rider.service';
import { OpsMapService } from './opsMap.service';
import { RiderController, AdminRidersController } from './rider.controller';
import { AdminDispatchController, AdminOpsMapController } from './admin.controller';

/** product-spec §5 realtime/dispatch อยู่ในโปรเซส NestJS เดียวกันไปก่อน */
@Module({
  imports: [AuthModule],
  controllers: [
    RiderController, AdminDispatchController, AdminRidersController, AdminOpsMapController,
  ],
  providers: [DispatchService, DispatchScheduler, RiderService, OpsMapService, AdminGuard],
  exports: [DispatchService],
})
export class DispatchModule {}
