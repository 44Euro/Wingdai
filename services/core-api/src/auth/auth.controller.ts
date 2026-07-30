import { Controller, Post, Get, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ZodBody } from '../common/zod.pipe';
import { AuthService, type PublicAccount, type SessionClaims } from './auth.service';
import { OtpService } from './otp.service';
import { JwtGuard, CurrentAccount } from './jwt.guard';
import {
  OtpRequestSchema, type OtpRequestInput,
  OtpVerifySchema, type OtpVerifyInput,
  RegisterSchema, type RegisterInput,
  LoginSchema, type LoginInput,
  GoogleSignInSchema, type GoogleSignInInput,
  GoogleRegisterSchema, type GoogleRegisterInput,
} from './dto';

/**
 * ลำดับการสมัครตรงกับที่แอปทำอยู่ (claude.md §4.2):
 *   กรอกฟอร์ม → otp/request → otp/verify (ได้ตั๋ว) → register (ยื่นตั๋ว) → ได้ token
 *
 * ยืนยันเบอร์เกิดก่อนบัญชีจะมีอยู่จริง จึงต้องผูกกับเบอร์ ไม่ใช่ผูกกับบัญชี
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
  ) {}

  @Post('otp/request')
  @HttpCode(200)
  requestOtp(@Body(new ZodBody(OtpRequestSchema)) body: OtpRequestInput) {
    return this.otp.request(body.phone);
  }

  @Post('otp/verify')
  @HttpCode(200)
  verifyOtp(@Body(new ZodBody(OtpVerifySchema)) body: OtpVerifyInput) {
    return this.otp.verify(body.phone, body.code);
  }

  @Post('register')
  register(@Body(new ZodBody(RegisterSchema)) body: RegisterInput) {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodBody(LoginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  /**
   * Google sign-in ขั้นแรก — เคยผูกไว้แล้วได้ token เลย ยังไม่เคยได้ตั๋วไปเดินฟอร์มสั้นต่อ
   * ตอบ 200 ทั้งสองกรณีเพราะทั้งคู่คือ "สำเร็จ" ต่างกันแค่ขั้นถัดไป
   */
  @Post('google')
  @HttpCode(200)
  google(@Body(new ZodBody(GoogleSignInSchema)) body: GoogleSignInInput) {
    return this.auth.googleSignIn(body.idToken);
  }

  @Post('google/register')
  googleRegister(@Body(new ZodBody(GoogleRegisterSchema)) body: GoogleRegisterInput) {
    return this.auth.googleRegister(body);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@CurrentAccount() claims: SessionClaims): Promise<PublicAccount> {
    return this.auth.publicAccount(claims.sub);
  }
}
