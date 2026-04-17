import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GoogleAuthController } from "./google-auth.controller";
import { isGoogleOAuthConfigured } from "./google-oauth.config";
import { GoogleStrategy } from "./google.strategy";
import { JwtStrategy } from "./jwt.strategy";
import { SupabaseStorageService } from "../storage/supabase-storage.service";

@Module({})
export class AuthModule {
  static register(): DynamicModule {
    const googleEnabled = isGoogleOAuthConfigured();

    return {
      module: AuthModule,
      imports: [
        ConfigModule,
        PassportModule.register({ defaultStrategy: "jwt" }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (config: ConfigService) => {
            const secret = config.get<string>("JWT_SECRET");
            if (!secret) {
              throw new Error("JWT_SECRET must be set for AuthModule");
            }
            const expiresIn = config.get<string>("JWT_EXPIRES_IN") ?? "7d";
            return {
              secret,
              signOptions: {
                expiresIn: expiresIn as
                  | `${number}d`
                  | `${number}h`
                  | `${number}m`
                  | `${number}s`,
              },
            };
          },
          inject: [ConfigService],
        }),
      ],
      controllers: [
        AuthController,
        ...(googleEnabled ? [GoogleAuthController] : []),
      ],
      providers: [
        AuthService,
        SupabaseStorageService,
        JwtStrategy,
        ...(googleEnabled ? [GoogleStrategy] : []),
      ],
      exports: [AuthService, JwtModule, SupabaseStorageService],
    };
  }
}
