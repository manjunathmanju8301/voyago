import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, HttpCode } from '@nestjs/common';
import { ApiRoutes, ApiOperation as ApiOperationEnum, ApiTags as ApiTagsEnum, Public } from '@/common/index.js';

@ApiTags(ApiTagsEnum.HEALTH)
@Controller()
export class HealthController {
    @Public()
    @Get(ApiRoutes.HEALTH)
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.HEALTH_CHECK })
    @ApiResponse({ status: 200, description: 'Health check passed' })
    healthCheck() {
        return { status: 'ok' };
    }
}
