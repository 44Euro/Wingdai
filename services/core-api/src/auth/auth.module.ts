import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ENV } from '../config.module';
import type { Env } from '../config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { JwtGuard } from './jwt.guard';
import { SMS_SENDER, ConsoleSmsSender } from './sms';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        secret: env.JWT_SECRET,
        // ไม่ตั้ง expiresIn ตรงนี้ เพราะตั๋วสองชนิดอายุต่างกันมาก
        // (เซสชัน 30 วัน กับตั๋วยืนยันเบอร์ 15 นาที) — กำหนดตอน sign แต่ละที่แทน
        signOptions: { issuer: 'wingdai' },
        verifyOptions: { issuer: 'wingdai' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    JwtGuard,
    // claude.md §11 ข้อ 3 ยังไม่เลือกผู้ให้บริการ SMS — สลับคลาสนี้ตัวเดียวเมื่อเลือกได้แล้ว
    { provide: SMS_SENDER, useClass: ConsoleSmsSender },
  ],
  exports: [AuthService, JwtGuard],
})
export class AuthModule {}
