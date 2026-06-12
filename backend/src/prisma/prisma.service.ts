import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient as PrismaMongoClient } from '@prisma/client';

// Check if POSTGRESQL_URL is provided, set a dummy fallback if missing to prevent validation errors at module load time
const hasPostgresUrl = !!process.env.POSTGRESQL_URL;
if (!hasPostgresUrl) {
    process.env.POSTGRESQL_URL = 'postgresql://dummy:dummy@localhost:5432/dummy';
}

import { PrismaClient as PrismaPostgresqlClient } from '@/generated/postgresql-client/index.js';

const logger = new Logger('PrismaPostgresqlService');

@Injectable()
export class PrismaService extends PrismaMongoClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}

@Injectable()
export class PrismaPostgresqlService extends PrismaPostgresqlClient implements OnModuleInit, OnModuleDestroy {
    private readonly isConfigured: boolean;

    constructor() {
        super();
        this.isConfigured = hasPostgresUrl;
    }

    async onModuleInit() {
        if (!this.isConfigured) {
            logger.warn('PostgreSQL URL not configured, skipping connection');
            return;
        }
        await this.$connect();
    }

    async onModuleDestroy() {
        if (!this.isConfigured) {
            return;
        }
        await this.$disconnect();
    }
}
