import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

import { RouterModule } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { CsrfController } from './csrf.controller';

import {
  AuthConfigModule,
  DatabaseModule,
  DatabaseModuleOptions,
} from '@vritti/api-sdk';
import { CloudApiModule } from './modules/cloud-api/cloud-api.module';
import { TenantModule } from './modules/cloud-api/tenant/tenant.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate,
    }),
    // Multi-tenant database module (Gateway Mode)
    // forServer() automatically registers TenantContextInterceptor and imports RequestModule
    DatabaseModule.forServer({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const options: DatabaseModuleOptions = {
          // Primary database configuration for tenant registry
          primaryDb: {
            host: config.getOrThrow<string>('PRIMARY_DB_HOST'),
            port: config.get<number>('PRIMARY_DB_PORT'),
            username: config.getOrThrow<string>('PRIMARY_DB_USERNAME'),
            password: config.getOrThrow<string>('PRIMARY_DB_PASSWORD'),
            database: config.getOrThrow<string>('PRIMARY_DB_DATABASE'),
            schema: config.get<string>('PRIMARY_DB_SCHEMA'),
            sslMode: config.get<'require' | 'prefer' | 'disable'>(
              'PRIMARY_DB_SSL_MODE',
            ),
          },
          prismaClientConstructor: PrismaClient,

          // Connection pool configuration
          connectionCacheTTL: 300000, // 5 minutes
          maxConnections: 10,
        };
        return options;
      },
    }),
    // Authentication module (Global guard + JWT)
    // Must be imported after DatabaseModule since VrittiAuthGuard depends on its services
    AuthConfigModule.forRootAsync(),
    CloudApiModule,
    RouterModule.register([
      {
        path: 'cloud-api',
        module: CloudApiModule,
        children: [
          {
            path: 'tenants',
            module: TenantModule,
          },
        ],
      },
    ]),
  ],
  controllers: [AppController, CsrfController],
  providers: [AppService],
})
export class AppModule {}
