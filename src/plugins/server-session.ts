import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono/types';
import { GlobalConfig } from '../config.js';
import type { SessionPayload, SessionToken } from '../domain/token.js';
import { getAccount } from '../repositories/account-repository.js';
import { deleteSessionToken, getSessionToken, updateTokenPayload } from '../repositories/token-repository.js';
import { generateSecureToken } from '../utils/util.js';

export function initSessionCookie(c: Context, session: SessionToken) {
	const maxAgeSeconds = Math.floor(GlobalConfig.TIMEOUT_SESSION / 1000);
	setCookie(c, 'sid', session.id, { sameSite: 'Lax', path: '/', httpOnly: true, maxAge: maxAgeSeconds });
}
export function clearSessionCookie(c: Context) {
	deleteCookie(c, 'sid');
}

/**
 * Set privilege elevation for the current session.
 * Creates a random token stored in both the session and a separate cookie.
 * The elevation expires after TIMEOUT_PRIVILEGE_ELEVATION.
 */
export function elevatePrivilege(c: Context, session: SessionToken): void {
	const token = generateSecureToken(32);
	const now = Date.now();

	// Update session payload with elevation info
	if (!session.payload) {
		session.payload = {};
	}
	session.payload.privilegeElevationToken = token;
	session.payload.privilegeElevatedAt = now;
	updateTokenPayload<SessionPayload>(session.id, 'session', session.payload);

	// Set short-lived privilege cookie
	const maxAgeSeconds = Math.floor(GlobalConfig.TIMEOUT_PRIVILEGE_ELEVATION / 1000);
	setCookie(c, 'priv', token, {
		sameSite: 'Strict',
		path: '/',
		httpOnly: true,
		maxAge: maxAgeSeconds,
	});
}

/**
 * Clear privilege elevation for the current session.
 */
export function clearPrivilegeElevation(c: Context, session: SessionToken): void {
	if (session.payload) {
		delete session.payload.privilegeElevationToken;
		delete session.payload.privilegeElevatedAt;
		updateTokenPayload<SessionPayload>(session.id, 'session', session.payload);
	}
	deleteCookie(c, 'priv', { sameSite: 'Strict', path: '/', httpOnly: true });
}

/**
 * Check if the current session has valid privilege elevation.
 */
export function isPrivilegeElevated(c: Context, session: SessionToken | null): boolean {
	if (!session?.payload?.privilegeElevationToken || !session?.payload?.privilegeElevatedAt) {
		return false;
	}

	const cookieToken = getCookie(c, 'priv');
	if (!cookieToken) {
		return false;
	}

	// Constant-time comparison to prevent timing attacks
	if (!timingSafeEqual(cookieToken, session.payload.privilegeElevationToken)) {
		return false;
	}

	// Check if elevation has expired
	const elapsed = Date.now() - session.payload.privilegeElevatedAt;
	if (elapsed > GlobalConfig.TIMEOUT_PRIVILEGE_ELEVATION) {
		return false;
	}

	return true;
}

/**
 * Get remaining time of privilege elevation in milliseconds.
 * Returns 0 if not elevated or expired.
 */
export function getPrivilegeElevationRemaining(c: Context, session: SessionToken | null): number {
	if (!isPrivilegeElevated(c, session)) {
		return 0;
	}
	const elapsed = Date.now() - (session?.payload?.privilegeElevatedAt || 0);
	const remaining = GlobalConfig.TIMEOUT_PRIVILEGE_ELEVATION - elapsed;
	return Math.max(0, remaining);
}

/**
 * Store a flash message in the session. Will be read and cleared on the next page load.
 */
export function setSessionFlash(session: SessionToken, flash: { type: 'success' | 'error' | 'info'; message: string }): void {
	if (!session.payload) {
		session.payload = {};
	}
	session.payload.flash = flash;
	updateTokenPayload<SessionPayload>(session.id, 'session', session.payload);
}

/**
 * Read and clear the flash message from the session. Returns null if no flash is set.
 */
export function consumeSessionFlash(session: SessionToken): { type: 'success' | 'error' | 'info'; message: string } | null {
	const flash = session.payload?.flash ?? null;
	if (flash) {
		delete session.payload?.flash;
		updateTokenPayload<SessionPayload>(session.id, 'session', session.payload!);
	}
	return flash;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

export function sessionMiddleware(): MiddlewareHandler {
	return async function session(c, next) {
		const sid = getCookie(c, 'sid');
		if (!sid) {
			c.set('session', null);
			return await next();
		}

		const session = getSessionToken(sid);
		if (!session) {
			deleteCookie(c, 'sid', { sameSite: 'Lax', path: '/', httpOnly: true });
			c.set('session', null);
			return await next();
		}

		if (session.expires < Date.now()) {
			deleteCookie(c, 'sid', { sameSite: 'Lax', path: '/', httpOnly: true });
			deleteSessionToken(session.id);
			c.set('session', null);
			return await next();
		}

		c.set('session', session);
		if (session.accountId) {
			const account = getAccount(session.accountId);
			if (account) {
				c.set('account', account);
			} else {
				deleteSessionToken(session.id);
				c.set('session', null);
			}
		}
		await next();
	};
}
