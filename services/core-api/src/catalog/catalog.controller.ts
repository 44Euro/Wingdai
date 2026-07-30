import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { OptionalJwtGuard, CurrentAccountId } from '../auth/jwt.guard';

/**
 * เปิดให้ดูได้โดยไม่ต้องล็อกอิน — คนที่ยังไม่มีบัญชีต้องเห็นว่ามีร้านอะไรบ้างก่อนตัดสินใจสมัคร
 * แต่ถ้าล็อกอินมาก็จะได้ระยะทางจากที่อยู่ของตัวเองเพิ่มมาด้วย
 */
@Controller('catalog')
@UseGuards(OptionalJwtGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('restaurants')
  list(@CurrentAccountId() accountId: string | null, @Query('q') q?: string) {
    return q === undefined ? this.catalog.list(accountId) : this.catalog.search(q, accountId);
  }

  @Get('restaurants/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentAccountId() accountId: string | null) {
    return this.catalog.get(id, accountId);
  }

  @Get('restaurants/:id/menu')
  menu(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.menu(id);
  }
}
