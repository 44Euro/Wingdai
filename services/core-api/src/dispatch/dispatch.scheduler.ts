import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DispatchService } from './dispatch.service';

/** ทุก 3 วินาที ละเอียดพอสำหรับหน้าต่างตอบรับ 15 วินาที (§6.3) โดยไม่ถามฐานถี่เกินจำเป็น */
const TICK_MS = 3_000;

/** เดินเครื่องจ่ายงานเป็นรอบ ๆ ในโปรเซสเดียวกับ API (product-spec §5) */
@Injectable()
export class DispatchScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('DispatchScheduler');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly dispatch: DispatchService) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    // ไม่ให้ timer ตัวนี้ค้ำโปรเซสไว้ตอนสั่งปิด
    this.timer.unref?.();
    this.log.log(`เริ่มรอบจ่ายงานทุก ${TICK_MS / 1000} วินาที`);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    // รอบก่อนยังไม่จบ (ฐานช้า) ข้ามรอบนี้ ดีกว่าซ้อนกันจนเสนองานซ้ำ
    if (this.running) return;
    this.running = true;
    try {
      const { expired, offered } = await this.dispatch.tick();
      if (expired || offered) this.log.log(`หมดเวลา ${expired} · เสนอใหม่ ${offered}`);
    } catch (error) {
      // รอบเดียวพังต้องไม่ทำให้เครื่องจ่ายงานหยุดถาวร รอบหน้าลองใหม่
      this.log.error(`รอบจ่ายงานล้ม: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
