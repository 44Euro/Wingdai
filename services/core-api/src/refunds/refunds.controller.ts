import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, ParseUUIDPipe, Query } from '@nestjs/common';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/admin.guard';
import type { SessionClaims } from '../auth/auth.service';
import { RefundsService } from './refunds.service';
import { ExceptionsService } from './exceptions.service';
import { OpenCaseSchema, type OpenCaseInput, DecideCaseSchema, type DecideCaseInput } from './dto';

/** ฝั่งลูกค้า — แจ้งปัญหาและดูสถานะเรื่องของตัวเอง */
@Controller('refunds')
@UseGuards(JwtGuard)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Post()
  open(
    @CurrentAccount() me: SessionClaims,
    @Body(new ZodBody(OpenCaseSchema)) body: OpenCaseInput,
  ) {
    return this.refunds.open(me.sub, body);
  }

  @Get()
  mine(@CurrentAccount() me: SessionClaims) {
    return this.refunds.listForCustomer(me.sub);
  }
}

/**
 * ฝั่งแอดมิน — คิวเรื่องที่ต้องตัดสิน + จอ exception-based (§7) + ตัวเลขจาก §8
 *
 * AdminGuard อ่าน account_type จากฐานทุกครั้ง ไม่อ่านจากตั๋ว เพราะตั๋วอายุ 30 วัน
 */
@Controller('admin')
@UseGuards(JwtGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly refunds: RefundsService,
    private readonly exceptions: ExceptionsService,
  ) {}

  /** จอแรกของแอดมิน — เฉพาะสิ่งที่ต้องมีคนเข้าไปยุ่ง ไม่ใช่ฟีดออร์เดอร์ทั้งหมด */
  @Get('exceptions')
  list() {
    return this.exceptions.list();
  }

  @Get('metrics')
  metrics(@Query('days') days?: string) {
    const parsed = Number(days);
    return this.exceptions.metrics(Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 90) : 7);
  }

  @Get('refunds')
  openCases() {
    return this.refunds.listOpen();
  }

  /** §6.4 — จุดเดียวที่เงินคืนออกจริง และต้องมีคนกดเสมอ */
  @Post('refunds/:id')
  @HttpCode(200)
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(DecideCaseSchema)) body: DecideCaseInput,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.refunds.decide(me.sub, id, body);
  }
}
