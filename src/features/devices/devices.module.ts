// NestJS
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { AuthModule } from '../auth/auth.module';
import { EntrancesModule } from '../entrances/entrances.module';

// Repository
import { DEVICE_REPOSITORY } from './domain/repositories/device.repository';

// Infrastructure
import { devicesProviders } from './infrastructure/persistence/providers/devices.providers';
import { DeviceOrmEntity } from './infrastructure/persistence/typeorm/device.orm-entity';

// Use cases
import { CreateDeviceUseCase } from './application/use-cases/create-device.use-case';
import { DeleteDeviceUseCase } from './application/use-cases/delete-device.use-case';
import { GetDeviceUseCase } from './application/use-cases/get-device.use-case';
import { ListDevicesUseCase } from './application/use-cases/list-devices.use-case';
import { RotateDeviceTokenUseCase } from './application/use-cases/rotate-device-token.use-case';
import { UpdateDeviceUseCase } from './application/use-cases/update-device.use-case';

// Presentation
import { DevicesController } from './presentation/http/controllers/devices.controller';

/**
 * Módulo de dispositivos do app do porteiro (CRUD por empresa — ADR 0008).
 *
 * Importa `AuthModule` para os use cases de JWT/validação usados pelos guards
 * compartilhados e `EntrancesModule` para o `ENTRANCE_REPOSITORY` (validação
 * do vínculo com portaria e `parameters` da listagem). **Sem ciclo**: entrances
 * não importa devices.
 */
@Module({
  imports: [
    AuthModule,
    EntrancesModule,
    TypeOrmModule.forFeature([DeviceOrmEntity]),
  ],
  providers: [
    ...devicesProviders,
    CreateDeviceUseCase,
    ListDevicesUseCase,
    GetDeviceUseCase,
    UpdateDeviceUseCase,
    DeleteDeviceUseCase,
    RotateDeviceTokenUseCase,
  ],
  controllers: [DevicesController],
  exports: [DEVICE_REPOSITORY],
})
export class DevicesModule {}
