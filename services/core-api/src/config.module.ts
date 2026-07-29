import { Global, Module } from '@nestjs/common';
import { loadEnv } from './config';

export const ENV = 'WINGDAI_ENV';

/** อ่านและตรวจ .env ครั้งเดียวตอนบูต แล้วแจกให้ทุกโมดูลผ่าน DI */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
