import type { OpenAPIObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

/**
 * When Google env vars are unset, {@link GoogleAuthController} is not mounted.
 * Merge these paths so OpenAPI still documents the contract.
 */
export function mergeGoogleOAuthSwaggerPaths(document: OpenAPIObject): void {
  if (!document.paths) {
    document.paths = {};
  }

  document.paths["/api/auth/google"] = {
    get: {
      tags: ["auth", "Google OAuth"],
      summary: "Start Google OAuth",
      description:
        "Browser-only entry: redirects to Google consent. Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` at runtime — set those and restart the API to enable this route.\n\n" +
        "Swagger “Try it out” is not useful here; open the URL in a browser or start from the web app.",
      operationId: "authGoogleStart",
      responses: {
        "302": {
          description: "Redirect to Google’s authorization server",
          headers: {
            Location: {
              description: "Google OAuth 2.0 authorization URL",
              schema: { type: "string" },
            },
          },
        },
        "401": { description: "Authentication failed (Passport / Google)" },
        "500": { description: "Google OAuth not configured or strategy error" },
      },
    },
  };

  document.paths["/api/auth/google/callback"] = {
    get: {
      tags: ["auth", "Google OAuth"],
      summary: "Google OAuth callback",
      description:
        "Google redirects here with an authorization `code`. The server exchanges it for tokens, creates or links the user, then **302 redirects** to `{FRONTEND_URL}/auth/callback?access_token=<JWT>` for the SPA to store the session.\n\n" +
        "Configure **Authorized redirect URI** in Google Cloud Console to match `GOOGLE_CALLBACK_URL` (e.g. `http://localhost:4000/api/auth/google/callback`).",
      operationId: "authGoogleCallback",
      parameters: [
        {
          name: "code",
          in: "query",
          required: false,
          description:
            "Authorization code from Google (present when the user approves access)",
          schema: { type: "string" },
        },
        {
          name: "state",
          in: "query",
          required: false,
          description: "Opaque state (CSRF) if configured in your Google client",
          schema: { type: "string" },
        },
        {
          name: "scope",
          in: "query",
          required: false,
          description: "Granted scopes (Google may include)",
          schema: { type: "string" },
        },
        {
          name: "error",
          in: "query",
          required: false,
          description: "Set if the user denied access (e.g. `access_denied`)",
          schema: { type: "string" },
        },
        {
          name: "error_description",
          in: "query",
          required: false,
          description: "Human-readable error from Google",
          schema: { type: "string" },
        },
      ],
      responses: {
        "302": {
          description:
            "Redirect to the frontend with JWT: `Location: {FRONTEND_URL}/auth/callback?access_token=...`",
          headers: {
            Location: {
              description: "Next.js app URL including `access_token` query param",
              schema: { type: "string" },
            },
          },
        },
        "401": { description: "Invalid or expired OAuth code / Google error" },
      },
    },
  };
}
