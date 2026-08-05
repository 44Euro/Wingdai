import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../auth/admin.guard';
import { SupportService } from './support.service';
import { SupportController, AdminSupportController } from './support.controller';

@Module({
  imports: [AuthModule],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService, AdminGuard],
})
export class SupportModule {}
