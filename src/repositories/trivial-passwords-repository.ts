import { db } from '../infrastructure/db.js';

export function isTrivialPassword(password: string): boolean {
	const result = db.prepare('SELECT 1 FROM trivial_passwords WHERE password = ? LIMIT 1').get(password.toLowerCase());
	return result !== undefined;
}
