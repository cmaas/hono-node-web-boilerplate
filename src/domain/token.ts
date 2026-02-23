export type TokenType = 'session' | 'verifyEmail' | 'passwordReset' | 'login';

export interface Token<T> {
	id: string;
	created: number;
	expires: number;
	accountId: string;
	type: TokenType;
	payload: T | null;
}

export interface TokenDTO extends Omit<Token<string>, 'payload'> {
	payload: string;
}

export interface SessionTokenPayload {
	userAgent?: string;
	lastActivity?: number; // UNIX timestamp in milliseconds
	previousVisit?: number; // UNIX timestamp in milliseconds
	privilegeElevationToken?: string;
	privilegeElevatedAt?: number; // UNIX timestamp in milliseconds
	flash?: { type: 'success' | 'error' | 'info'; message: string };
}

export interface VerifyEmailTokenPayload {
	email: string;
}

export interface PasswordResetTokenPayload {
	verifyEmail: string;
	userAgent?: string;
}

export interface LoginTokenPayload {
	verifyEmail: string;
	userAgent?: string;
}

export type SessionToken = Token<SessionTokenPayload>;
export type VerifyEmailToken = Token<VerifyEmailTokenPayload>;
export type PasswordResetToken = Token<PasswordResetTokenPayload>;
export type LoginToken = Token<LoginTokenPayload>;
