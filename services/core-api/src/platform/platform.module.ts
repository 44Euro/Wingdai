import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard, SuperAdminGuard } from '../auth/admin.guard';
import { PlatformService } from './platform.service';
import { AuditService } from './audit.service';
import { ZonesService } from './zones.service';
import { AdminRolesService } from './adminRoles.service';
import { SuperController } from './super.controller';
import { ConfigController } from './config.controller';
import { RefundsModule } from '../refunds/refunds.module';

/** Global เพราะราคาและ feature flag เป็นสิ่งที่โมดูลอื่นต้องอ่านตอนตัดสินใจ: */
@Global()
@Module({
  imports: [AuthModule, RefundsModule],
  controllers: [SuperController, ConfigController],
  providers: [
    PlatformService, AuditService, ZonesService, AdminRolesService, AdminGuard, SuperAdminGuard,
  ],
  exports: [PlatformService, AuditService],
})
export class PlatformModule {}
