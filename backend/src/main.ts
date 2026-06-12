import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { configureApp } from './config/index.js';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule, 
        new FastifyAdapter({ bodyLimit: 10 * 1024 * 1024 }), 
        { bufferLogs: true },
    );

    await configureApp(app);
    
    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT') ?? 3000;
    const host = configService.get<string>('HOST') ?? '0.0.0.0';
    
    await app.listen(port, host);
    app.get(Logger).log(`Server listening on port ${port}`);
}

void bootstrap();
