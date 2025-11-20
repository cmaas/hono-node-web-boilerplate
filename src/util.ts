import { compare, hash } from 'bcryptjs';

const SECURE_TOKEN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-';

export function isValidEmail(s: string): boolean {
	if (!s || typeof s !== 'string') {
		return false;
	}
	const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return re.test(s);
}

export function generateSecureToken(length = 16) {
	if (length < 1) {
		console.warn('generateSecureToken: length must be at least 1, defaulting to 1');
		length = 1;
	}
	if (length > 256) {
		console.warn('generateSecureToken: length must be at most 256, defaulting to 256');
		length = 256;
	}
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return Array.from(array, byte => SECURE_TOKEN_ALPHABET[byte % SECURE_TOKEN_ALPHABET.length]).join('');
}

export function isValidToken(token: string | null | undefined): boolean {
	if (!token || typeof token !== 'string') {
		return false;
	}
	if (token.length < 1 || token.length > 256) {
		return false;
	}
	const re = /^[0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-]{1,256}$/;
	return re.test(token);
}

export async function isSamePassword(hashedAccountPassword: string, providedPassword: string): Promise<boolean> {
	if (!hashedAccountPassword || !providedPassword) {
		return false;
	}
	return compare(providedPassword, hashedAccountPassword);
}

export async function hashPassword(password: string): Promise<string> {
	return hash(password, 10);
}

export function satisfiesPasswordPolicy(password: string): boolean {
	if (!password || typeof password !== 'string') {
		return false;
	}
	if (password.trim().length < 8) {
		return false;
	}
	if (['asdfasdf', 'password', '12345678', 'qwertyuiop'].includes(password.trim().toLowerCase())) {
		return false;
	}
	return true;
}