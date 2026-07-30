import {
  Controller, Get, Post, Delete, Param, Query, UseGuards, ParseUUIDPipe, HttpCode,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { OptionalJwtGuard, CurrentAccountId, JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import type { SessionClaims } from '../auth/auth.service';

/** เปิดให้ดูได้โดยไม่ต้องล็อกอิน คนที่ยังไม่มีบัญชีต้องเห็นว่ามีร้านอะไรบ้างก่อนตัดสินใจสมัคร */
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

/** รายการโปรด (design C19) แยก controller เพราะต้องล็อกอิน */
@Controller('favorites')
@UseGuards(JwtGuard)
export class FavoritesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@CurrentAccount() me: SessionClaims) {
    return this.catalog.listFavorites(me.sub);
  }

  @Get('ids')
  ids(@CurrentAccount() me: SessionClaims) {
    return this.catalog.favoriteIds(me.sub);
  }

  @Post(':restaurantId')
  @HttpCode(200)
  add(@Param('restaurantId', ParseUUIDPipe) id: string, @CurrentAccount() me: SessionClaims) {
    return this.catalog.setFavorite(me.sub, id, true);
  }

  @Delete(':restaurantId')
  @HttpCode(200)
  remove(@Param('restaurantId', ParseUUIDPipe) id: string, @CurrentAccount() me: SessionClaims) {
    return this.catalog.setFavorite(me.sub, id, false);
  }
}
