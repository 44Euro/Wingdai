import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import type { SessionClaims } from '../auth/auth.service';
import { StorageService, buildDocumentPath } from './storage.service';

/** ชนิดเอกสารที่ไรเดอร์ส่งได้ (product-spec §7) */
export const RIDER_DOCUMENT_KINDS = [
  'selfie',
  'id_card_front',
  'id_card_back',
  'licence',
  'vehicle_book',
  'insurance',
] as const;

export type RiderDocumentKind = (typeof RIDER_DOCUMENT_KINDS)[number];

const SignUploadSchema = z.object({
  kind: z.enum(RIDER_DOCUMENT_KINDS),
  /** นามสกุลไฟล์ ไม่มีจุดนำหน้า service ตรวจซ้ำอีกชั้นว่าอยู่ในรายการที่รับ */
  ext: z.string().trim().min(2).max(5),
});

/** รูปยืนยันส่ง (R11) ผูกกับออร์เดอร์ใบเดียว เพื่อให้ระบบตรวจข้อพิพาทหาเจอ (§6.4) */
const SignProofSchema = z.object({
  orderId: z.uuid(),
  ext: z.string().trim().min(2).max(5),
});

/** ขอลิงก์อัปโหลดสำหรับเอกสารไรเดอร์ */
@Controller('storage')
@UseGuards(JwtGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('rider-documents/sign-upload')
  async signRiderDocument(
    @Body(new ZodBody(SignUploadSchema)) body: z.infer<typeof SignUploadSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    const path = buildDocumentPath(me.sub, body.kind, body.ext);
    return this.storage.signUpload('rider-docs', path);
  }

  /** รูปยืนยันส่ง (design R11) */
  @Post('delivery-proof/sign-upload')
  async signDeliveryProof(
    @Body(new ZodBody(SignProofSchema)) body: z.infer<typeof SignProofSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    const path = buildDocumentPath(me.sub, `proof-${body.orderId}`, body.ext);
    return this.storage.signUpload('rider-docs', path);
  }
}
