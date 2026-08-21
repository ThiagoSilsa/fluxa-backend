import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './features/auth/auth.module';
import { BlocksModule } from './features/blocks/blocks.module';
import { DepartmentsModule } from './features/departments/departments.module';
import { DevicesModule } from './features/devices/devices.module';
import { EntrancesModule } from './features/entrances/entrances.module';
import { ImportsModule } from './features/imports/imports.module';
import { RolesModule } from './features/roles/roles.module';
import { UsersModule } from './features/users/users.module';
import { VehiclesModule } from './features/vehicles/vehicles.module';
import { buildTypeOrmOptions } from './shared/database/typeorm/config/typeorm.config';
import { HttpErrorCodeFilter } from './shared/filters/http-error-code.filter';
import { QueueModule } from './shared/queue/queue.module';
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
    QueueModule,
    AuthModule,
    BlocksModule,
    RolesModule,
    UsersModule,
    DepartmentsModule,
    EntrancesModule,
    DevicesModule,
    VehiclesModule,
    ImportsModule,
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
    // Filtro global que adiciona `code` estável ao corpo de erro (ADR 0007 §7).
    {
      provide: APP_FILTER,
      useClass: HttpErrorCodeFilter,
    },
  ],
})
export class AppModule {}
