import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { isGoogleOAuthConfigured } from "./auth/google-oauth.config";
import { mergeGoogleOAuthSwaggerPaths } from "./swagger/merge-google-oauth.swagger";
import { RedisIoAdapter } from "./websocket/redis-io.adapter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const wsAdapter = new RedisIoAdapter(app);
  if (process.env.REDIS_URL?.trim()) {
    try {
      await wsAdapter.connectToRedis();
      Logger.log("WebSocket: Redis adapter enabled (multi-instance pub/sub).");
    } catch (err) {
      Logger.error(
        `WebSocket: failed to connect Redis adapter (${process.env.REDIS_URL})`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  } else {
    Logger.warn(
      "WebSocket: in-memory adapter only — set REDIS_URL to scale Socket.IO across instances.",
    );
  }
  app.useWebSocketAdapter(wsAdapter);

  const frontendOrigin = process.env.FRONTEND_URL ?? "http://localhost:3000";

  app.enableCors({
    origin: frontendOrigin,
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix("api");

  const apiPort = Number(process.env.API_PORT ?? 4000);
  const defaultServerUrl = process.env.SWAGGER_SERVER_URL ?? `http://localhost:${apiPort}`;

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Zovate API")
    .setDescription(
      [
        "REST API for the Zovate workspace.",
        "",
        "**Authentication**",
        "- **Email & password:** `POST /auth/register`, `POST /auth/login` — returns `access_token` and `user`.",
        "- **Bearer JWT:** send `Authorization: Bearer <access_token>` for protected routes (e.g. `GET /auth/me`).",
        "- **Google:** `GET /auth/google` starts OAuth; `GET /auth/google/callback` completes it and redirects the browser to the frontend with `access_token`. Google routes require `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL`.",
        "",
        "Swagger UI: **Authorize** uses the JWT scheme for endpoints that show a lock icon.",
      ].join("\n"),
    )
    .setVersion("1.0")
    .addServer(defaultServerUrl, "API (default local)")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "Authorization",
        description:
          "JWT from `POST /auth/login`, `POST /auth/register`, or Google OAuth redirect flow",
        in: "header",
      },
      "access-token",
    )
    .addTag(
      "auth",
      "Registration, login, session health, and Google OAuth (browser redirects).",
    )
    .addTag(
      "Google OAuth",
      "`GET /auth/google` and `GET /auth/google/callback` — configure Google Cloud OAuth client and env vars; use a browser, not raw JSON clients.",
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  if (!isGoogleOAuthConfigured()) {
    mergeGoogleOAuthSwaggerPaths(document);
  }
  SwaggerModule.setup("docs", app, document, {
    useGlobalPrefix: true,
  });

  await app.listen(apiPort);
}

void bootstrap();
