import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './features/auth/auth.module';
import { buildTypeOrmOptions } from './shared/database/typeorm/config/typeorm.config';
import { validateEnvironment } from './shared/validators/environment.validator';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => buildTypeOrmOptions(),
    }),
    AuthModule,
  ],
})
export class AppModule {}
