import { Controller, Get, Query, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HotelsService } from './hotels.service.js';
import { SearchHotelsDto } from './dto/index.js';
import { HOTELS_SEARCH_SUCCESS } from '@/common/index.js';

@ApiTags('Hotels')
@Controller('hotels')
export class HotelsController {
    constructor(private readonly hotelsService: HotelsService) {}

    @Get('search')
    @HttpCode(200)
    @ApiOperation({ summary: 'Search hotels by city' })
    async searchHotels(@Query() dto: SearchHotelsDto) {
        const data = await this.hotelsService.searchHotels(dto);
        return { message: HOTELS_SEARCH_SUCCESS, data };
    }
}
