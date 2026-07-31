import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../auth/admin.guard';
import { RefundsService } from './refunds.service';
import { ExceptionsService } from './exceptions.service';
import { RefundsController, AdminController } from './refunds.controller';

@Module({
  imports: [AuthModule],
  controllers: [RefundsController, AdminController],
  providers: [RefundsService, ExceptionsService, AdminGuard],
})
export class RefundsModule {}
