import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './features/auth/auth.module';
import { RolesModule } from './features/roles/roles.module';
import { buildTypeOrmOptions } from './shared/database/typeorm/config/typeorm.config';
import { ThrottlerConfigModule } from './shared/throttler/throttler-config.module';
import { validateEnvironment } from './shared/validators/environment.validator';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: () => buildTypeOrmOptions(),
    }),
    ThrottlerConfigModule,
    AuthModule,
    RolesModule,
  ],
  providers: [
    // Validação global de DTOs (sem tocar no main.ts — AGENTS.md).
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    },
  ],
})
export class AppModule {}
