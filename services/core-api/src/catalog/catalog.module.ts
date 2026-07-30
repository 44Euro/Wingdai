import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogController, FavoritesController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [AuthModule],
  controllers: [CatalogController, FavoritesController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
