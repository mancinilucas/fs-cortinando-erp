// Session lifetime approved in D29 and centralized in D42: absolute 12-hour
// expiration, without sliding renewal or refresh tokens. Both the persisted
// expires_at and the cookie Max-Age derive from this single value.
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
