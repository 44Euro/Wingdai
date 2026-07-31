import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../auth/admin.guard';
import { DispatchService } from './dispatch.service';
import { DispatchScheduler } from './dispatch.scheduler';
import { RiderService } from './rider.service';
import { RiderController } from './rider.controller';
import { AdminDispatchController } from './admin.controller';

/**
 * claude.md §5 — realtime/dispatch อยู่ในโปรเซส NestJS เดียวกันไปก่อน
 * แยกออกเป็นเซอร์วิสจริงเมื่อจำนวนคอนเนกชันบังคับ ไม่ใช่ก่อนหน้านั้น
 */
@Module({
  imports: [AuthModule],
  controllers: [RiderController, AdminDispatchController],
  providers: [DispatchService, DispatchScheduler, RiderService, AdminGuard],
  exports: [DispatchService],
})
export class DispatchModule {}
