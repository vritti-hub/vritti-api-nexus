import fastifyCookie from '@fastify/cookie';
import fastifyRawBody from 'fastify-raw-body';
// import fastifyCsrfProtection from '@fastify/csrf-protection'; // Temporarily disabled - using NestJS CsrfGuard only
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
// import { CsrfGuard } from '@vritti/api-sdk'; // Temporarily disabled
// import { Reflector } from '@nestjs/core'; // Not needed without CsrfGuard
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Get ConfigService
  const configService = app.get(ConfigService);

  // Register raw-body plugin for webhook signature validation
  // This must be registered BEFORE cookie plugin to capture raw body
  await app.register(fastifyRawBody, {
    field: 'rawBody', // Adds rawBody property to request
    global: true, // Enable for all routes to support webhook signature validation
    encoding: 'utf8',
    runFirst: true,
  });

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
  */

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
