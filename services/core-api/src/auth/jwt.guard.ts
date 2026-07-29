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
    // มาสวมเป็นเซสชันได้เลย ทั้งที่ตอนออกให้ยังไม่มีบัญชีด้วยซ้ำ
    if (claims.typ !== 'session') {
      throw new UnauthorizedException({ message: 'ตั๋วนี้ใช้เข้าสู่ระบบไม่ได้' });
    }

    // อ่านสถานะบัญชีจากฐานทุกครั้ง ไม่เชื่อ claims อย่างเดียว
    // ไม่งั้นบัญชีที่เพิ่งถูกปิดจะยังใช้ตั๋วเดิมได้ต่ออีก 30 วัน
    await this.auth.assertActive(claims.sub);

    req.account = claims;
    return true;
  }
}

export const CurrentAccount = createParamDecorator((_: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<Request>().account!;
});
