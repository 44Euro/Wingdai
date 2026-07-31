import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';

@Module({
  imports: [AuthModule],
  controllers: [MerchantController],
  providers: [MerchantService],
})
export class MerchantModule {}
