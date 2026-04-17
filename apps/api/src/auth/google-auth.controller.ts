import { Controller, Get, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";

@ApiTags("auth", "Google OAuth")
@Controller("auth")
export class GoogleAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get("google")
  @UseGuards(AuthGuard("google"))
  @ApiProduces("text/html")
  @ApiOperation({
    operationId: "authGoogleStart",
    summary: "Start Google OAuth",
    description:
      "Redirects the browser to Google’s consent screen. Use from the web app or open this URL in a browser — not via JSON clients alone.\n\n" +
      "**Env:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (must match Google Cloud **Authorized redirect URIs**).",
  })
  @ApiResponse({
    status: 302,
    description: "Redirect to Google authorization endpoint",
    headers: {
      Location: {
        description: "Google OAuth 2.0 authorization URL",
        schema: { type: "string" },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Passport / Google rejected the request",
  })
  googleAuth(): void {
    /* Passport initiates redirect */
  }

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  @ApiProduces("text/html")
  @ApiOperation({
    operationId: "authGoogleCallback",
    summary: "Google OAuth callback",
    description:
      "Google redirects here after consent. The server issues a JWT and **302 redirects** to `{FRONTEND_URL}/auth/callback?access_token=<JWT>`.\n\n" +
      "**Env:** `FRONTEND_URL` — the Next.js origin (e.g. `http://localhost:3000`).",
  })
  @ApiQuery({
    name: "code",
    required: false,
    description:
      "Authorization code (present when the user grants access). Exchanged server-side for tokens.",
  })
  @ApiQuery({
    name: "state",
    required: false,
    description: "Opaque anti-CSRF value if used by the OAuth client",
  })
  @ApiQuery({
    name: "scope",
    required: false,
    description: "Space-delimited scopes returned by Google",
  })
  @ApiQuery({
    name: "error",
    required: false,
    description: "OAuth error code if the user denied access",
  })
  @ApiQuery({
    name: "error_description",
    required: false,
    description: "Human-readable error from Google",
  })
  @ApiResponse({
    status: 302,
    description:
      "Redirect to the SPA with JWT in query string (development convenience; prefer httpOnly cookies in production)",
    headers: {
      Location: {
        description:
          "Typically `{FRONTEND_URL}/auth/callback?access_token=<JWT>`",
        schema: { type: "string", example: "http://localhost:3000/auth/callback?access_token=eyJhbG..." },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Invalid code, denied consent, or token exchange failure",
  })
  googleCallback(@Req() req: Request, @Res() res: Response): void {
    const user = req.user as Express.User;
    const tokens = this.auth.issueTokensForUser({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      isVerified: user.isVerified,
    });

    const frontendBase =
      this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000";
    const base = frontendBase.replace(/\/$/, "");
    const redirectUrl = new URL(`${base}/auth/callback`);
    redirectUrl.searchParams.set("access_token", tokens.access_token);
    res.redirect(302, redirectUrl.toString());
  }
}
