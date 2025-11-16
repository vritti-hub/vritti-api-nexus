import fastifyCookie from '@fastify/cookie';
import fastifyCsrfProtection from '@fastify/csrf-protection';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { CsrfGuard, HttpExceptionFilter } from '@vritti/api-sdk';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Get ConfigService
  const configService = app.get(ConfigService);

  // Register cookie support
  await app.register(fastifyCookie, {
    secret: configService.getOrThrow<string>('COOKIE_SECRET'),
  });

  // Register CSRF protection
  await app.register(fastifyCsrfProtection, {
    cookieOpts: {
      signed: true,
      httpOnly: true,
      sameSite: 'lax', // IMPORTANT: 'strict' breaks OAuth redirects
      secure: process.env.NODE_ENV === 'production',
      path: '/', // Cookie must be available for all endpoints
    },
    csrfOpts: {
      hmacKey: configService.getOrThrow<string>('CSRF_HMAC_KEY'),
    },
  });

  // Register global exception filter for RFC 7807 Problem Details format
  // This filter transforms all exceptions (custom, NestJS built-in, DTO validation)
  // into a consistent format with errors array: { errors: [{ field?, message }] }
  app.useGlobalFilters(new HttpExceptionFilter());

  // Register global CSRF guard
  app.useGlobalGuards(new CsrfGuard(app.get(Reflector)));

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
  console.log(`API Nexus running on http://localhost:${port}`);
}
bootstrap();
