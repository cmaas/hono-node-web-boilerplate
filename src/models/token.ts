import { GlobalConfig } from '../config.js';
import { db } from '../db.js';
import { generateSecureToken } from '../util.js';

export type TokenType = 'session' | 'verifyEmail' | 'passwordReset';

export interface Token<T> {
	id: string;
	created: number;
	expires: number;
	accountId: string;
	type: TokenType;
	payload: T | null;
}

interface TokenDTO extends Omit<Token<string>, 'payload'> {
	payload: string;
}

export interface SessionPayload {
	userAgent?: string;
	lastActivity?: number; // UNIX timestamp in milliseconds
	previousVisit?: number; // UNIX timestamp in milliseconds
}
export interface VerifyEmailPayload {
	email: string;
}
export interface PasswordResetPayload {
	userAgent?: string;
}

export type SessionToken = Token<SessionPayload>;
export type VerifyEmailToken = Token<VerifyEmailPayload>;
export type PasswordResetToken = Token<PasswordResetPayload>;

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
		payload
	};
	db.prepare('INSERT INTO tokens (id, created, expires, accountId, type, payload) VALUES (?, ?, ?, ?, ?, ?)')
		.run(token.id, token.created, token.expires, token.accountId, token.type, payloadStr);
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
	return createRawToken<SessionPayload>(accountId, expires, 'session', payload);
}
export function getSessionToken(id: string): SessionToken | null {
	return getRawToken<SessionPayload>(id, 'session');
}
export function getSessionTokensForAccount(accountId: string): Array<SessionToken> {
	const rows = <Array<SessionToken>>db.prepare('SELECT * FROM tokens WHERE accountId = ? AND type = ?')
		.all(accountId, 'session');
	if (!rows || rows.length === 0) {
		return [];
	}
	const tokens = rows.map(row => {
		const payload = unmarshallPayload<SessionPayload>(row.payload as any);
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
	return createRawToken<VerifyEmailPayload>(accountId, expires, 'verifyEmail', { email });
}
export function getVerifyEmailToken(id: string): VerifyEmailToken | null {
	return getRawToken<VerifyEmailPayload>(id, 'verifyEmail');
}
export function deleteVerifyEmailToken(id: string): void {
	deleteRawToken(id, 'verifyEmail');
}

// ----- Password Reset Tokens -----
export function createPasswordResetToken(accountId: string, payload: { userAgent: string }): PasswordResetToken {
	const expires = Date.now() + GlobalConfig.TIMEOUT_PASSWORD_RESET;
	return createRawToken<PasswordResetPayload>(accountId, expires, 'passwordReset', payload);
}
export function getPasswordResetToken(id: string): PasswordResetToken | null {
	return getRawToken<PasswordResetPayload>(id, 'passwordReset');
}
export function deletePasswordResetToken(id: string): void {
	deleteRawToken(id, 'passwordReset');
}

// ----- Generic Token Payload Update -----
export function updateTokenPayload<T>(id: string, type: TokenType, payload: T): boolean {
	const payloadStr = marshallPayload(payload);
	const result = db.prepare('UPDATE tokens SET payload = ? WHERE id = ? AND type = ?')
		.run(payloadStr, id, type);
	return result.changes > 0;
}

/**
 * Keeps track of the last activity of the session. After a certain period of inactivity,
 * the last activity timestamp becomes the previousVisit timestamp.
 * @param session The session token to update
 * @returns
 */
export function updateLastSessionActivity(session: SessionToken | null): void {
	if (!session || !session.payload) {
		return;
	}

	const now = Date.now();
	const lastActivity = session.payload.lastActivity || 0;

	if (lastActivity > 0 && lastActivity < now - GlobalConfig.TIMEOUT_INACTIVITY_LAST_VISIT_REFRESH) {
		console.debug(`updateLastSessionActivity: updating previousVisit for session ${session.id}: ${new Date(lastActivity).toISOString()}`);
		session.payload.previousVisit = lastActivity;
	}

	session.payload.lastActivity = now;
	updateTokenPayload<SessionPayload>(session.id, 'session', session.payload);
}