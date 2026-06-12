import { Module, Global } from '@nestjs/common';
import { PrismaService, PrismaPostgresqlService } from './prisma.service.js';

@Global()
@Module({
    providers: [PrismaService, PrismaPostgresqlService],
    exports: [PrismaService, PrismaPostgresqlService],
})
export class PrismaModule { }
