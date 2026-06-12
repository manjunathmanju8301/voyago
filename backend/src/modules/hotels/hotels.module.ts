import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HotelsService } from './hotels.service.js';
import { HotelsController } from './hotels.controller.js';
import { GeocodingHelper } from '@/common/helpers/geocoding.helper.js';

@Module({
    imports: [ConfigModule],
    providers: [HotelsService, GeocodingHelper],
    controllers: [HotelsController],
    exports: [HotelsService],
})
export class HotelsModule {}
