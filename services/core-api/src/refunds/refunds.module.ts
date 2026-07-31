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
  // SA1 ใช้ตัวเลขชุดเดียวกับ AD1 คิดใหม่อีกชุดคือทางลัดสู่ตัวเลขสองชุดที่ไม่ตรงกัน
  exports: [ExceptionsService],
})
export class RefundsModule {}
