import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger/OpenAPI em /api (autorizado explicitamente — ver AGENTS.md).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fluxa API')
    .setDescription('API do sistema de controle de acesso de veículos.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  // CORS liberado em desenvolvimento (frontend Vite em http://localhost:3001).
  // TODO: Restringir origens via variável de ambiente (ex.: CORS_ORIGINS) quando houver deploy.
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
// TODO: Restringir o Swagger a ambientes não-produtivos (NODE_ENV !== 'production') quando houver deploy.
void bootstrap();
