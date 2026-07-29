import { Global, Module } from '@nestjs/common';
import { loadEnv } from './config';

export const ENV = 'WINGDAI_ENV';

/**
 * อ่านและตรวจ .env ครั้งเดียวตอนบูต แล้วแจกให้ทุกโมดูลผ่าน DI
 *
 * ไม่ใช้ @nestjs/config เพราะมันตรวจชนิดไม่ได้ — process.env.PORT ยังคงเป็น string | undefined
 * ทั้งที่โค้ดคาดว่าเป็น number ส่วน loadEnv() ใน config.ts คืนค่าที่ผ่าน zod แล้ว
 */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
