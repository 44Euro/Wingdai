import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

/** Global เพราะทั้งฝั่งไรเดอร์ (เอกสาร R8 รูปยืนยันส่ง R11) ฝั่งร้าน (โลโก้ รูปเมนู) */
@Global()
@Module({
  imports: [AuthModule],
  providers: [StorageService],
  controllers: [StorageController],
  exports: [StorageService],
})
export class StorageModule {}
