/** Cookie name for JWT (mirrored from localStorage for middleware). */
export const AUTH_COOKIE_NAME = "zovate_access_token";

/** Default max-age aligned with typical API `JWT_EXPIRES_IN` (7d). */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
