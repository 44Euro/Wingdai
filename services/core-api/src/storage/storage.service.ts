import { Injectable, BadRequestException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

/** บักเก็ตสองตัวที่แยกกันด้วย สิทธิ์การอ่าน ไม่ใช่ประเภทเนื้อหา */
export type PrivateBucket = 'rider-docs';
export type PublicBucket = 'public-media';
export type StorageBucket = PrivateBucket | PublicBucket;

/** นามสกุลที่รับ */
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic'] as const;

export function assertAllowedExtension(ext: string): void {
  if (!ALLOWED_EXT.includes(ext.toLowerCase() as (typeof ALLOWED_EXT)[number])) {
    throw new BadRequestException({ message: `นามสกุลไฟล์ ${ext} ไม่รองรับ` });
  }
}

/** เส้นทางไฟล์ ขึ้นต้นด้วย accountId เสมอ */
export function buildDocumentPath(accountId: string, kind: string, ext: string): string {
  assertAllowedExtension(ext);
  for (const part of [accountId, kind]) {
    if (part.length === 0 || part.includes('/') || part.includes('..')) {
      throw new BadRequestException({ message: `ส่วนของเส้นทางไม่ถูกต้อง: "${part}"` });
    }
  }
  return `${accountId}/${kind}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext.toLowerCase()}`;
}

/** ทางเข้าเดียวสู่ Supabase Storage */
@Injectable()
export class StorageService {
  private cached: SupabaseClient | null = null;

  /**
   * สร้างตอนใช้จริง ไม่ใช่ตอนบูต
   * โมดูลนี้เป็น @Global() Nest จึงสร้าง service ตอนเปิดแอปเสมอ ถ้าโยนตรงนั้นแปลว่า
   * ไม่มีกุญแจ Supabase แล้วทั้ง API เปิดไม่ขึ้น ทั้งที่มีแค่ไม่กี่เส้นทางที่ใช้ Storage
   * ซึ่งทำให้รันบน CI หรือเครื่อง dev ที่ยังไม่มีกุญแจไม่ได้เลย
   */
  private get client(): SupabaseClient {
    if (this.cached) return this.cached;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('ต้องตั้ง SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ก่อนใช้ Storage');
    }
    this.cached = createClient(url, key, { auth: { persistSession: false } });
    return this.cached;
  }

  /** แอปอัปโหลดเข้า URL นี้โดยตรง service role key ไม่เคยออกจากเซิร์ฟเวอร์ */
  async signUpload(bucket: StorageBucket, path: string) {
    const { data, error } = await this.client.storage.from(bucket).createSignedUploadUrl(path);
    if (error) throw new BadRequestException({ message: `ขอลิงก์อัปโหลดไม่สำเร็จ: ${error.message}` });
    return { uploadUrl: data.signedUrl, token: data.token, path };
  }

  /** อ่านของในบักเก็ตปิด */
  async signDownload(bucket: PrivateBucket, path: string, expiresInSeconds = 300) {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error) throw new BadRequestException({ message: `ขอลิงก์อ่านไม่สำเร็จ: ${error.message}` });
    return data.signedUrl;
  }

  publicUrl(path: string): string {
    return this.client.storage.from('public-media').getPublicUrl(path).data.publicUrl;
  }
}
