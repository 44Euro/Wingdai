import { Global, Module, Inject, OnApplicationShutdown } from '@nestjs/common';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { loadEnv } from '../config';
import * as schema from './schema';

export const DB = 'WINGDAI_DB';
export const PG_CLIENT = 'WINGDAI_PG_CLIENT';

export type Db = PostgresJsDatabase<typeof schema>;

function createClient() {
  const env = loadEnv();
  const url = env.DATABASE_POOL_URL ?? env.DATABASE_URL;
  // pooler ของ Supabase ทำงานแบบ transaction mode ซึ่งไม่มี session state ให้เก็บ prepared statement
  // ถ้าไม่ปิด prepare จะเจอ error "prepared statement already exists" แบบสุ่ม ๆ ตอนโหลดเยอะ
  const throughPooler = url.includes('pooler.supabase.com');

  return postgres(url, {
    max: 10,
    ssl: 'require',
    prepare: !throughPooler,
    // Supabase วาง PostGIS ไว้ที่ schema `extensions` — ไม่ใส่ตรงนี้จะอ้างชนิด geometry ไม่เจอ
    connection: { search_path: 'public,extensions' },
    onnotice: () => {},
  });
}

/**
 * ตัวเชื่อมฐานข้อมูลมีตัวเดียวทั้งแอป (claude.md §5 — Supabase เป็นชั้นข้อมูล ไม่ใช่ชั้นตรรกะ)
 *
 * ประกาศเป็น Global เพราะแทบทุกโมดูลต้องใช้ การบังคับให้ import ซ้ำทุกที่ไม่ได้เพิ่มความปลอดภัยอะไร
 */
@Global()
@Module({
  providers: [
    { provide: PG_CLIENT, useFactory: createClient },
    {
      provide: DB,
      inject: [PG_CLIENT],
      useFactory: (client: postgres.Sql) => drizzle(client, { schema }),
    },
  ],
  exports: [DB, PG_CLIENT],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(PG_CLIENT) private readonly client: postgres.Sql) {}

  /** ปิดคอนเนกชันตอนดับเซิร์ฟเวอร์ ไม่งั้น Supabase จะเห็นคอนเนกชันค้างจนเต็มโควตา */
  async onApplicationShutdown() {
    await this.client.end({ timeout: 5 });
  }
}
