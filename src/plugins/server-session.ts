/**
 * @module
 * Session Middleware for Hono.
 */

import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono/types';
import { getAccount } from '../models/account.js';
import { deleteSessionToken, getSessionToken, type SessionToken } from '../models/token.js';

export function initSessionCookie(c: Context, session: SessionToken) {
	setCookie(c, 'sid', session.id, { sameSite: 'Lax', path: '/', httpOnly: true });
}
export function clearSessionCookie(c: Context) {
	deleteCookie(c, 'sid');
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
				// no account found for session, delete session from DB
				deleteSessionToken(session.id);
				c.set('session', null);
			}
		}
		await next();
	};
}
