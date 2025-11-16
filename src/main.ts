import fastifyCookie from '@fastify/cookie';
import fastifyRawBody from 'fastify-raw-body';
// import fastifyCsrfProtection from '@fastify/csrf-protection'; // Temporarily disabled - using NestJS CsrfGuard only
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import {
  CorrelationIdMiddleware,
  CsrfGuard,
  HttpExceptionFilter,
  HttpLoggerInterceptor,
  LoggerService,
} from '@vritti/api-sdk';
import { AppModule } from './app.module';

async function bootstrap() {
  // When using default provider, let NestJS use its built-in logger to avoid circular reference
  // When using Winston, we need to use LoggerService
  const logProvider = process.env.LOG_PROVIDER || 'winston';
  const useBuiltInLogger = logProvider === 'default';

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    // Only pass custom logger for Winston to avoid circular reference with default provider
    useBuiltInLogger ? {} : {
      logger: new LoggerService({
        environment: process.env.NODE_ENV 
      })
    },
  );

  // Get services from DI container
  const configService = app.get(ConfigService);

  // Only replace logger when using Winston provider
  // Default provider would create circular reference if we call app.useLogger()
  if (!useBuiltInLogger) {
    const appLogger = app.get(LoggerService);
    app.useLogger(appLogger);
  }

  // Register cookie support
  await app.register(fastifyCookie, {
    secret: configService.getOrThrow<string>('COOKIE_SECRET'),
  });

  // NOTE: Fastify CSRF protection temporarily disabled to allow webhooks
  // Using NestJS CsrfGuard only, which respects @Public() decorator
  // TODO: Re-enable with proper webhook exclusion configuration
  /*
  await app.register(fastifyCsrfProtection, {
    cookieOpts: {
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
    csrfOpts: {
      hmacKey: configService.getOrThrow<string>('CSRF_HMAC_KEY'),
    },
  });

  // Register global exception filter for RFC 7807 Problem Details format
  // This filter transforms all exceptions (custom, NestJS built-in, DTO validation)
  // into a consistent format with errors array: { errors: [{ field?, message }] }
  app.useGlobalFilters(new HttpExceptionFilter());

  // Register correlation ID middleware for request tracking using Fastify hooks
  // Using addHook ensures AsyncLocalStorage context persists throughout request lifecycle
  const correlationMiddleware = app.get(CorrelationIdMiddleware);
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook('onRequest', async (request, reply) => {
    await correlationMiddleware.onRequest(request as any, reply as any);
  });

  // Register HTTP logger interceptor for request/response logging
  const httpLoggerInterceptor = app.get(HttpLoggerInterceptor);
  app.useGlobalInterceptors(httpLoggerInterceptor);

  // Register global CSRF guard
  // Temporarily disabled - requires Fastify CSRF plugin which conflicts with webhooks
  // TODO: Re-enable with proper webhook exclusion or use alternative CSRF protection
  // app.useGlobalGuards(new CsrfGuard(app.get(Reflector)));

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // Preserve ValidationError objects with property and constraints fields
      // This ensures HttpExceptionFilter can extract field names from DTO validation errors
      exceptionFactory: (errors) => {
        return new BadRequestException(errors);
      },
    }),
  );

  // Enable CORS for frontend applications
  app.enableCors({
    origin: [
      'http://localhost:5173', // Host app
      'http://localhost:3001', // Auth MF
      'http://localhost:5174', // Other possible ports
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  // Get logger from DI container for final bootstrap message
  const logger = app.get(LoggerService);
  logger.log(`API Nexus running on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
