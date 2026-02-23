import { GlobalConfig } from '../config.js';
import type { LoginToken, LoginTokenPayload, PasswordResetToken, PasswordResetTokenPayload, SessionToken, SessionTokenPayload, Token, TokenDTO, TokenType, VerifyEmailToken, VerifyEmailTokenPayload } from '../domain/token.js';
import { db } from '../infrastructure/db.js';
import { generateSecureToken } from '../utils/util.js';

// ----- Helper Functions -----
function marshallPayload<T>(payload: T | null): string {
	if (payload === null || payload === undefined) {
		return '';
	}
	try {
		return JSON.stringify(payload);
	} catch (e) {
		console.debug('(token.marshallPayload) failed to stringify payload', e);
		return '';
	}
}

function unmarshallPayload<T>(payloadStr: string): T | null {
	if (!payloadStr) {
		return null;
	}
	try {
		return <T>JSON.parse(payloadStr);
	} catch (e) {
		console.debug('(token.unmarshallPayload) failed to parse payload', e);
		return null;
	}
}

// ----- Core Token Operations -----
export function createRawToken<T>(accountId: string, expires: number, type: TokenType, payload: T | null, tokenLength = 32): Token<T> {
	const payloadStr = marshallPayload(payload);
	const token: Token<T> = {
		id: generateSecureToken(tokenLength),
		created: Date.now(),
		expires: expires,
		accountId,
		type,
		payload,
	};
	db.prepare('INSERT INTO tokens (id, created, expires, accountId, type, payload) VALUES (?, ?, ?, ?, ?, ?)').run(token.id, token.created, token.expires, token.accountId, token.type, payloadStr);
	return token;
}

export function getRawToken<T>(id: string, type: TokenType): Token<T> | null {
	const row = <TokenDTO>db.prepare(`SELECT * FROM tokens WHERE id = ? AND type = ?`).get(id, type);
	if (!row) {
		return null;
	}
	const payload = unmarshallPayload<T>(row.payload);
	return { id: row.id, created: row.created, expires: row.expires, accountId: row.accountId, type: row.type, payload };
}

export function deleteRawToken(id: string, type: TokenType): void {
	db.prepare(`DELETE FROM tokens WHERE id = ? AND type = ?`).run(id, type);
}

// ----- Session Tokens -----
export function createSessionToken(accountId: string, payload: { userAgent: string }): SessionToken {
	const expires = Date.now() + GlobalConfig.TIMEOUT_SESSION;
	return createRawToken<SessionTokenPayload>(accountId, expires, 'session', payload);
}
export function getSessionToken(id: string): SessionToken | null {
	return getRawToken<SessionTokenPayload>(id, 'session');
}
export function getSessionTokensForAccount(accountId: string): Array<SessionToken> {
	const rows = <Array<SessionToken>>db.prepare('SELECT * FROM tokens WHERE accountId = ? AND type = ?').all(accountId, 'session');
	if (!rows || rows.length === 0) {
		return [];
	}
	const tokens = rows.map((row) => {
		const payload = unmarshallPayload<SessionTokenPayload>(row.payload as any);
		row.payload = payload;
		return row;
	});
	return tokens;
}
export function deleteSessionToken(id: string): void {
	deleteRawToken(id, 'session');
}

// ----- Verify Email Tokens -----
export function createVerifyEmailToken(accountId: string, email: string): VerifyEmailToken {
	const expires = Date.now() + GlobalConfig.TIMEOUT_VERIFY_EMAIL;
	return createRawToken<VerifyEmailTokenPayload>(accountId, expires, 'verifyEmail', { email });
}
export function getVerifyEmailToken(id: string): VerifyEmailToken | null {
	return getRawToken<VerifyEmailTokenPayload>(id, 'verifyEmail');
}
export function deleteVerifyEmailToken(id: string): void {
	deleteRawToken(id, 'verifyEmail');
}

// ----- Password Reset Tokens -----
export function createPasswordResetToken(accountId: string, payload: PasswordResetTokenPayload): PasswordResetToken {
	const expires = Date.now() + GlobalConfig.TIMEOUT_PASSWORD_RESET;
	return createRawToken<PasswordResetTokenPayload>(accountId, expires, 'passwordReset', payload);
}
export function getPasswordResetToken(id: string): PasswordResetToken | null {
	return getRawToken<PasswordResetTokenPayload>(id, 'passwordReset');
}
export function deletePasswordResetToken(id: string): void {
	deleteRawToken(id, 'passwordReset');
}

// ----- Login Tokens -----
export function createLoginToken(accountId: string, payload: LoginTokenPayload): LoginToken {
	const expires = Date.now() + GlobalConfig.TIMEOUT_LOGIN_TOKEN;
	return createRawToken<LoginTokenPayload>(accountId, expires, 'login', payload);
}
export function getLoginToken(id: string): LoginToken | null {
	return getRawToken<LoginTokenPayload>(id, 'login');
}
export function deleteLoginToken(id: string): void {
	deleteRawToken(id, 'login');
}

// ----- Generic Token Payload Update -----
export function updateTokenPayload<T>(id: string, type: TokenType, payload: T): boolean {
	const payloadStr = marshallPayload(payload);
	const result = db.prepare('UPDATE tokens SET payload = ? WHERE id = ? AND type = ?').run(payloadStr, id, type);
	return result.changes > 0;
}

/**
 * Keeps track of the last activity of the session. After a certain period of inactivity,
 * the last activity timestamp becomes the previousVisit timestamp.
 */
export function updateLastSessionActivity(session: SessionToken | null): void {
	if (!session || !session.payload) {
		return;
	}

	const now = Date.now();
	const lastActivity = session.payload.lastActivity || 0;

	if (lastActivity > 0 && lastActivity < now - GlobalConfig.LAST_VISIT_REFRESH_AFTER_INACTIVITY) {
		//console.debug(`updateLastSessionActivity: updating previousVisit for session ${session.id}: ${new Date(lastActivity).toISOString()}`);
		session.payload.previousVisit = lastActivity;
	}

	session.payload.lastActivity = now;
	updateTokenPayload<SessionTokenPayload>(session.id, 'session', session.payload);
}
