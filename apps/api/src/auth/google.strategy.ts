import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy } from "passport-google-oauth20";
import { AuthService } from "./auth.service";

/**
 * Google OAuth2 (authorization code). Sessionless — callback returns JWT from {@link AuthController.googleCallback}.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    const clientID = config.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = config.get<string>("GOOGLE_CLIENT_SECRET");
    const callbackURL = config.get<string>("GOOGLE_CALLBACK_URL");

    if (!clientID || !clientSecret || !callbackURL) {
      throw new Error(
        "Google OAuth requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL",
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ["email", "profile"],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ) {
    return this.auth.upsertGoogleUser({
      profile,
      accessToken,
      refreshToken: refreshToken?.length ? refreshToken : null,
    });
  }
}
