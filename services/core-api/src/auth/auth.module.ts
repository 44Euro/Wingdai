import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ENV } from '../config.module';
import type { Env } from '../config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { JwtGuard, OptionalJwtGuard } from './jwt.guard';
import { GoogleVerifier } from './google';
import { SMS_SENDER, ConsoleSmsSender } from './sms';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        secret: env.JWT_SECRET,
        // ไม่ตั้ง expiresIn ตรงนี้ เพราะตั๋วสองชนิดอายุต่างกันมาก
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
    OptionalJwtGuard,
    GoogleVerifier,
    // product-spec §11 ข้อ 3 ยังไม่เลือกผู้ให้บริการ SMS สลับคลาสนี้ตัวเดียวเมื่อเลือกได้แล้ว
    { provide: SMS_SENDER, useClass: ConsoleSmsSender },
  ],
  exports: [AuthService, JwtGuard, OptionalJwtGuard, JwtModule],
})
export class AuthModule {}
