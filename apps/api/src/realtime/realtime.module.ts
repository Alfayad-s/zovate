import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { RealtimeAuthService } from "./realtime-auth.service";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>("JWT_SECRET");
        if (!secret) {
          throw new Error("JWT_SECRET must be set for RealtimeModule");
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
  providers: [RealtimeGateway, RealtimeService, RealtimeAuthService],
  exports: [RealtimeService, RealtimeAuthService, JwtModule],
})
export class RealtimeModule {}
