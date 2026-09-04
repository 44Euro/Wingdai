import { Controller, Post, Get, Patch, Body, UseGuards, HttpCode } from '@nestjs/common';
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
  UpdateProfileSchema, type UpdateProfileInput,
  ChangePasswordSchema, type ChangePasswordInput,
  ChangePhoneSchema, type ChangePhoneInput,
  ResetPasswordSchema, type ResetPasswordInput,
} from './dto';

/** ลำดับการสมัครตรงกับที่แอปทำอยู่ (product-spec §4.2): */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
  ) {}

  @Post('otp/request')
  @HttpCode(200)
  requestOtp(@Body(new ZodBody(OtpRequestSchema)) body: OtpRequestInput) {
    return this.otp.request(body.phone, body.purpose);
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

  /** ลืมรหัสผ่าน ไม่ต้องล็อกอิน คำตอบเหมือนกันเสมอ ไม่บอกว่าเบอร์นี้มีบัญชีไหม (§4.2) */
  @Post('password/reset')
  @HttpCode(204)
  async resetPassword(@Body(new ZodBody(ResetPasswordSchema)) body: ResetPasswordInput) {
    await this.auth.resetPassword(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodBody(LoginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  /** Google sign-in ขั้นแรก เคยผูกไว้แล้วได้ token เลย ยังไม่เคยได้ตั๋วไปเดินฟอร์มสั้นต่อ */
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

  /** C21 แก้โปรไฟล์ เบอร์กับชื่อผู้ใช้แก้ทางนี้ไม่ได้ ดูเหตุผลใน auth.service */
  @Patch('me')
  @UseGuards(JwtGuard)
  updateMe(
    @CurrentAccount() claims: SessionClaims,
    @Body(new ZodBody(UpdateProfileSchema)) body: UpdateProfileInput,
  ): Promise<PublicAccount> {
    return this.auth.updateProfile(claims.sub, {
      fullName: body.fullName,
      email: body.email ?? null,
    });
  }

  /** เปลี่ยนรหัสผ่าน ต้องยืนยันรหัสเดิมก่อน */
  @Post('me/password')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  changePassword(
    @CurrentAccount() claims: SessionClaims,
    @Body(new ZodBody(ChangePasswordSchema)) body: ChangePasswordInput,
  ): Promise<PublicAccount> {
    return this.auth.changePassword(claims.sub, body);
  }

  /** เปลี่ยนเบอร์ ต้องยืนยัน OTP ของเบอร์ใหม่ก่อน เหมือนตอนสมัคร */
  @Patch('me/phone')
  @UseGuards(JwtGuard)
  changePhone(
    @CurrentAccount() claims: SessionClaims,
    @Body(new ZodBody(ChangePhoneSchema)) body: ChangePhoneInput,
  ): Promise<PublicAccount> {
    return this.auth.changePhone(claims.sub, body);
  }
}
