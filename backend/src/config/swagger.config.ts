import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

export const setupSwagger = (app: NestFastifyApplication) => {
    const config = new DocumentBuilder()
        .setTitle('Voyago API')
        .setDescription('API documentation for Voyago booking platform')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('docs', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            docExpansion: 'list',
            filter: true,
            showExtensions: true,
            tryItOutEnabled: true,
        }
    });
};
