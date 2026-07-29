import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadEnv } from './config';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  // แอปมือถือยิงข้ามโดเมนอยู่แล้ว และยังไม่มีคุกกี้/เซสชันฝั่งเบราว์เซอร์ให้ต้องกัน CSRF
  app.enableCors({ origin: true });
  // ให้ onApplicationShutdown ใน DbModule ได้ทำงาน ไม่งั้นคอนเนกชันค้างจนเต็มโควตา Supabase
  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');
  new Logger('Wingdai').log(`core-api ฟังอยู่ที่พอร์ต ${env.PORT} (${env.NODE_ENV})`);
}

bootstrap().catch((error) => {
  console.error('เปิดเซิร์ฟเวอร์ไม่สำเร็จ:', error.message);
  process.exit(1);
});
