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

export function createRawToken<T>(accountId: string, expires: number, type: TokenType, payload: T | null, tokenLength = 32): Token<T> {
	let payloadStr = '';
	if (payload !== null && payload !== undefined) {
		try {
			payloadStr = JSON.stringify(payload);
		} catch (e) {
			console.debug('(token.createRawToken) failed to stringify payload', e);
		}
	}
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
	let payload = null;
	try {
		payload = <T>JSON.parse(row.payload);
	} catch (e) {
		console.debug('(token.getRawToken) failed to parse payload', e);
	}

	return { id: row.id, created: row.created, expires: row.expires, accountId: row.accountId, type: row.type, payload };
}

export function deleteRawToken(id: string, type: TokenType): void {
	db.prepare(`DELETE FROM tokens WHERE id = ? AND type = ?`).run(id, type);
}

// ----- Session Tokens -----
export function createSessionToken(accountId: string, payload: { userAgent: string }): SessionToken {
	const expires = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
	return createRawToken<SessionPayload>(accountId, expires, 'session', payload);
}
export function getSessionToken(id: string): SessionToken | null {
	return getRawToken<SessionPayload>(id, 'session');
}
export function deleteSessionToken(id: string): void {
	deleteRawToken(id, 'session');
}

// ----- Verify Email Tokens -----
export function createVerifyEmailToken(accountId: string, email: string): VerifyEmailToken {
	const expires = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
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
	const expires = Date.now() + 1000 * 60 * 60 * 2; // 2 hours
	return createRawToken<PasswordResetPayload>(accountId, expires, 'passwordReset', payload);
}
export function getPasswordResetToken(id: string): PasswordResetToken | null {
	return getRawToken<PasswordResetPayload>(id, 'passwordReset');
}
export function deletePasswordResetToken(id: string): void {
	deleteRawToken(id, 'passwordReset');
}