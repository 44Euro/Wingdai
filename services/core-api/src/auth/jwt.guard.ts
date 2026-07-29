import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthService, type SessionClaims } from './auth.service';

declare module 'express' {
  interface Request {
    account?: SessionClaims;
  }
}

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException({ message: 'ต้องเข้าสู่ระบบก่อน' });
    }

    let claims: SessionClaims;
    try {
      claims = await this.jwt.verifyAsync<SessionClaims>(token);
    } catch {
      throw new UnauthorizedException({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }

    // ตั๋วยืนยันเบอร์เซ็นด้วยกุญแจดอกเดียวกัน ถ้าไม่เช็ค typ จะเอาตั๋ว 15 นาทีนั้น
    if (claims.typ !== 'session') {
      throw new UnauthorizedException({ message: 'ตั๋วนี้ใช้เข้าสู่ระบบไม่ได้' });
    }

    // อ่านสถานะบัญชีจากฐานทุกครั้ง ไม่เชื่อ claims อย่างเดียว
    await this.auth.assertActive(claims.sub);

    req.account = claims;
    return true;
  }
}

/** ปล่อยผ่านเสมอ แต่ถ้ามี token ที่ใช้ได้ก็แนบข้อมูลบัญชีไปด้วย */
@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) return true;

    try {
      const claims = await this.jwt.verifyAsync<SessionClaims>(token);
      if (claims.typ === 'session') req.account = claims;
    } catch {
      // token เสียหรือหมดอายุ = ถือว่าไม่ได้ล็อกอิน ไม่ใช่ error
    }
    return true;
  }
}

export const CurrentAccount = createParamDecorator((_: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<Request>().account!;
});

/** คืน accountId หรือ null คู่กับ OptionalJwtGuard */
export const CurrentAccountId = createParamDecorator((_: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<Request>().account?.sub ?? null;
});
